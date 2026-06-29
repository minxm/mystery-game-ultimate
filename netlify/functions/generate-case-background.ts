import type { Config } from '@netlify/functions';
import { buildCaseFromPhases } from '../../lib/generate-case-orchestrator';
import { setCaseJob } from '../../lib/case-job-store';
import { createFallbackCase } from '../../lib/fallback-case';

// Netlify background functions 最长运行 15 分钟，给 AI 生成留 5 分钟余量
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// v2 语法：default export + Request 参数，Blobs 在运行时自动注入，无需手动配置
export default async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { jobId, difficulty } = body as { jobId?: string; difficulty?: string };

  if (!jobId || !difficulty) {
    console.error('[Background] Missing jobId or difficulty');
    return;
  }

  console.log('[Background] Starting case generation for job:', jobId, 'difficulty:', difficulty);

  try {
    const caseData = await withTimeout(
      buildCaseFromPhases(difficulty),
      GENERATION_TIMEOUT_MS,
      'buildCaseFromPhases'
    );
    await setCaseJob(jobId, {
      status: 'done',
      caseData,
      createdAt: Date.now(),
    });
    console.log('[Background] Job completed:', jobId, caseData.title);
  } catch (error: any) {
    // AI 生成失败/超时时，不再让前端看到「生成失败」，而是回退到一个完整可玩的兜底案件，
    // 保证线上稳定：用户永远能拿到案件，最多是默认案件而非空白报错。
    console.error('[Background] Generation failed, using fallback:', jobId, error.message);
    try {
      const fallbackCase = createFallbackCase(difficulty);
      await setCaseJob(jobId, {
        status: 'done',
        caseData: fallbackCase,
        createdAt: Date.now(),
      });
      console.log('[Background] Fallback case served for job:', jobId, fallbackCase.title);
    } catch (storeError: any) {
      console.error('[Background] Failed to store fallback case:', storeError.message);
      try {
        await setCaseJob(jobId, {
          status: 'error',
          error: error.message || '案件生成失败',
          createdAt: Date.now(),
        });
      } catch (finalErr: any) {
        console.error('[Background] Failed to update job status:', finalErr.message);
      }
    }
  }
};

// v2 background function：客户端立即收到 202，函数在后台继续执行
export const config: Config = {
  background: true,
};
