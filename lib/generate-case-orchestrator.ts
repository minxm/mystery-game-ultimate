import {
  generateCaseBaseWithAI,
  generateCaseCastWithAI,
  generateCaseDetailsWithAI,
} from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import { mergeCasePhases } from '@/lib/case-schema';
import { getPhaseTimeoutMs } from '@/lib/ai-config';
import { CaseData } from '@/lib/types';

/** 给单个阶段加超时，超时则快速失败并交给上层重试，避免卡死拖垮总预算 */
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

/** 单个阶段失败（字段缺失/截断/解析/超时）时重试，提升小模型成功率 */
async function withPhaseRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  const phaseTimeoutMs = getPhaseTimeoutMs();
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), phaseTimeoutMs, label);
    } catch (error) {
      lastError = error;
      console.warn(
        `[Orchestrator] ${label} attempt ${attempt}/${maxAttempts} failed:`,
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

  console.log('[Orchestrator] Step 3/3: details');
  const details = await withPhaseRetry('details', () =>
    generateCaseDetailsWithAI(difficulty, { ...base, ...cast })
  );

  const merged = mergeCasePhases(base, cast, details);
  return buildCaseDataWithImages(difficulty, merged);
}
