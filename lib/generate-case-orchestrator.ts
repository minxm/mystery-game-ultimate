import {
  generateCaseBaseWithAI,
  generateCaseCastWithAI,
  generateCaseDetailsWithAI,
} from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import { CaseData } from '@/lib/types';

/** 单个阶段失败（瞬时网络/截断/解析错误）时重试一次，提升整体成功率 */
async function withPhaseRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(
        `[Orchestrator] ${label} attempt ${attempt} failed:`,
        (error as Error)?.message
      );
    }
  }
  throw lastError;
}

export async function buildCaseFromPhases(difficulty: string): Promise<CaseData> {
  console.log('[Orchestrator] Step 1/3: base');
  const base = await withPhaseRetry('base', () => generateCaseBaseWithAI(difficulty));

  console.log('[Orchestrator] Step 2/3: cast');
  const cast = await withPhaseRetry('cast', () => generateCaseCastWithAI(difficulty, base));

  const core = { ...base, ...cast };
  console.log('[Orchestrator] Step 3/3: details');
  const details = await withPhaseRetry('details', () =>
    generateCaseDetailsWithAI(difficulty, core)
  );

  return buildCaseDataWithImages(difficulty, { ...core, ...details });
}
