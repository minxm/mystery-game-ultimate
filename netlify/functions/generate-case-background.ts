import type { Handler } from '@netlify/functions';
import { buildCaseFromPhases } from '../../lib/generate-case-orchestrator';
import { setCaseJob } from '../../lib/case-job-store';

export const handler: Handler = async (event) => {
  const { jobId, difficulty } = JSON.parse(event.body || '{}');

  if (!jobId || !difficulty) {
    console.error('[Background] Missing jobId or difficulty');
    return { statusCode: 400, body: 'Missing jobId or difficulty' };
  }

  console.log('[Background] Starting case generation for job:', jobId);

  try {
    const caseData = await buildCaseFromPhases(difficulty);
    await setCaseJob(jobId, {
      status: 'done',
      caseData,
      createdAt: Date.now(),
    });
    console.log('[Background] Job completed:', jobId, caseData.title);
  } catch (error: any) {
    console.error('[Background] Job failed:', jobId, error.message);
    await setCaseJob(jobId, {
      status: 'error',
      error: error.message || '案件生成失败',
      createdAt: Date.now(),
    });
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

export const config = {
  type: 'experimental-background' as const,
};
