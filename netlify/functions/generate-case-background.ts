import type { Handler } from '@netlify/functions';
import { buildCaseFromPhases } from '../../lib/generate-case-orchestrator';
import { setCaseJob } from '../../lib/case-job-store';

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

export const handler: Handler = async (event) => {
  const { jobId, difficulty } = JSON.parse(event.body || '{}');

  if (!jobId || !difficulty) {
    console.error('[Background] Missing jobId or difficulty');
    return { statusCode: 400, body: 'Missing jobId or difficulty' };
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
    console.error('[Background] Job failed:', jobId, error.message);
    try {
      await setCaseJob(jobId, {
        status: 'error',
        error: error.message || '案件生成失败',
        createdAt: Date.now(),
      });
    } catch (storeError: any) {
      console.error('[Background] Failed to update job status:', storeError.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

export const config = {
  type: 'experimental-background' as const,
};
