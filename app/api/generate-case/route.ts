import { NextRequest, NextResponse } from 'next/server';
import { generateCaseWithAI } from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import { buildCaseFromPhases } from '@/lib/generate-case-orchestrator';
import {
  getCaseGenerationMaxRetries,
  getCaseGenerationTimeoutMs,
  getLocalPhasesTimeoutMs,
  isServerlessEnv,
} from '@/lib/ai-config';
import { generateId } from '@/lib/utils';
import { setCaseJob } from '@/lib/case-job-store';
import { createFallbackCase } from '@/lib/fallback-case';

export const maxDuration = 60;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function generateCaseWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const timeoutMs = getCaseGenerationTimeoutMs();
  const maxRetries = getCaseGenerationMaxRetries();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API] ${label} attempt ${attempt}/${maxRetries}, timeout: ${timeoutMs}ms`);
      return await withTimeout(fn(), timeoutMs, label);
    } catch (error: any) {
      lastError = error;
      console.warn(`[API] ${label} attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { difficulty, phase } = body;

    console.log('[API] Case generation request:', { difficulty, phase, serverless: isServerlessEnv() });

    if (phase === 'start') {
      if (isServerlessEnv()) {
        // Serverless 环境（Netlify）：同步函数受 ~26s 网关硬超时限制，
        // 72B 大模型 + 跨境调用国内 API 经常超时回退默认案件。
        // 改为异步：创建 pending 任务 → 触发可运行 15 分钟的后台函数 → 前端轮询 /status。
        const jobId = generateId();
        await setCaseJob(jobId, { status: 'pending', createdAt: Date.now() });

        const origin = request.nextUrl.origin;
        const triggerRes = await fetch(
          `${origin}/.netlify/functions/generate-case-background`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, difficulty }),
          }
        ).catch((e: any) => {
          console.error('[API] Trigger background function failed:', e?.message);
          return null;
        });

        // 后台函数正常会立即返回 202 Accepted
        if (!triggerRes || (triggerRes.status !== 202 && !triggerRes.ok)) {
          throw new Error(
            `后台生成任务触发失败${triggerRes ? `（HTTP ${triggerRes.status}）` : ''}`
          );
        }

        console.log('[API] Background job triggered:', jobId);
        return NextResponse.json({ success: true, jobId });
      }

      // 本地开发：多阶段生成。本地无 Serverless 网关硬超时，提示词变长后生成更慢，
      // 用更大的可配置总超时（默认 150s），避免还没生成完就回退默认案件。
      const caseData = await withTimeout(
        buildCaseFromPhases(difficulty),
        getLocalPhasesTimeoutMs(),
        'Local buildCaseFromPhases'
      );
      return NextResponse.json({ success: true, sync: true, caseId: caseData.id, caseData });
    }

    const caseContent = await generateCaseWithRetry('Case generation', () =>
      generateCaseWithAI(difficulty)
    );
    const caseData = await buildCaseDataWithImages(difficulty, caseContent);

    console.log('[API] Case data created successfully, id:', caseData.id);

    return NextResponse.json({ success: true, caseId: caseData.id, caseData });
  } catch (error: any) {
    console.error('[API] Case generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      stack: error.stack?.substring(0, 500),
    });

    if (error.status === 401 || error.message?.includes('SILICONFLOW_API_KEY')) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            'API 密钥无效。请在 .env.local 配置 SILICONFLOW_API_KEY（从 https://cloud.siliconflow.cn 获取）',
        },
        { status: 401 }
      );
    }

    const isTimeout =
      error.message?.includes('timed out') ||
      error.message?.includes('timeout') ||
      error.code === 'ECONNABORTED';

    console.log('[API] Using fallback case, isTimeout:', isTimeout);
    const fallbackCase = createFallbackCase();
    return NextResponse.json({
      success: true,
      sync: true,
      isFallback: true,
      caseId: fallbackCase.id,
      caseData: fallbackCase,
      error: isTimeout
        ? 'AI 生成超时（网络较慢），已使用默认案件，可正常游戏。'
        : 'AI 生成失败，已使用默认案件。请检查 SILICONFLOW_API_KEY 配置或稍后重试。',
    });
  }
}
