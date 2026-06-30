import type { Config } from '@netlify/functions';
import { executeCaseGenerationJob } from '../../lib/case-generation-job';

// Netlify background functions 最长 15 分钟
const GENERATION_TIMEOUT_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { jobId, difficulty, userId } = body as {
    jobId?: string;
    difficulty?: string;
    userId?: string | null;
  };

  if (!jobId || !difficulty) {
    console.error('[Background] Missing jobId or difficulty');
    return;
  }

  await executeCaseGenerationJob(jobId, difficulty, {
    timeoutMs: GENERATION_TIMEOUT_MS,
    userId: userId ?? null,
  });
};

export const config: Config = {
  background: true,
};
