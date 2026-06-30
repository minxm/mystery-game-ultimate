import { NextRequest, NextResponse } from 'next/server';
import { generateCaseWithAI } from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import {
  getCaseGenerationMaxRetries,
  getCaseGenerationTimeoutMs,
  isServerlessEnv,
} from '@/lib/ai-config';
import { generateId } from '@/lib/utils';
import { setCaseJob } from '@/lib/case-job-store';
import { createFallbackCase } from '@/lib/fallback-case';
import { getSessionUserId } from '@/lib/supabase/server';

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
    } catch (error: unknown) {
      lastError = error as Error;
      console.warn(`[API] ${label} attempt ${attempt} failed:`, lastError.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}

async function triggerBackgroundGeneration(
  origin: string,
  jobId: string,
  difficulty: string,
  userId?: string | null
): Promise<void> {
  if (isServerlessEnv()) {
    const triggerRes = await fetch(`${origin}/.netlify/functions/generate-case-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, difficulty, userId }),
    }).catch((e: unknown) => {
      console.error('[API] Trigger Netlify background failed:', (e as Error)?.message);
      return null;
    });

    if (!triggerRes || (triggerRes.status !== 202 && !triggerRes.ok)) {
      throw new Error(
        `后台生成任务触发失败${triggerRes ? `（HTTP ${triggerRes.status}）` : ''}`
      );
    }
    console.log('[API] Netlify background job triggered:', jobId);
    return;
  }

  // 本地开发：触发独立 worker 路由，立即返回 jobId，前端轮询 status
  void fetch(`${origin}/api/generate-case/worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, difficulty, userId }),
  }).catch((e: unknown) => {
    console.error('[API] Local worker trigger failed:', (e as Error)?.message);
  });
  console.log('[API] Local worker job triggered:', jobId);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { difficulty, phase } = body;

    console.log('[API] Case generation request:', { difficulty, phase, serverless: isServerlessEnv() });

    if (phase === 'start') {
      const jobId = generateId();
      const userId = await getSessionUserId().catch(() => null);
      const jobMeta = { userId, difficulty };
      await setCaseJob(jobId, { status: 'pending', stage: 'pending', createdAt: Date.now() }, jobMeta);

      await triggerBackgroundGeneration(request.nextUrl.origin, jobId, difficulty, userId);

      return NextResponse.json({ success: true, jobId });
    }

    const caseContent = await generateCaseWithRetry('Case generation', () =>
      generateCaseWithAI(difficulty)
    );
    const caseData = await buildCaseDataWithImages(difficulty, caseContent);

    console.log('[API] Case data created successfully, id:', caseData.id);

    return NextResponse.json({ success: true, caseId: caseData.id, caseData });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; type?: string; code?: string; stack?: string };
    console.error('[API] Case generation failed:', {
      message: err.message,
      status: err.status,
      type: err.type,
      stack: err.stack?.substring(0, 500),
    });

    if (err.status === 401 || err.message?.includes('SILICONFLOW_API_KEY')) {
      return NextResponse.json(
        {
          success: false,
          error:
            err.message ||
            'API 密钥无效。请在 .env.local 配置 SILICONFLOW_API_KEY（从 https://cloud.siliconflow.cn 获取）',
        },
        { status: 401 }
      );
    }

    const isTimeout =
      err.message?.includes('timed out') ||
      err.message?.includes('timeout') ||
      err.code === 'ECONNABORTED';

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
