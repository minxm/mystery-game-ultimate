import {
  generateCaseWithFrameworkAndPolish,
  generateFullCaseWithAI,
  generateCaseBaseWithAI,
  generateCaseCastWithAI,
  generateCaseDetailsWithAI,
  polishCaseWithAI,
} from '@/lib/ai';
import { buildCaseDataWithImages, buildCaseDataWithImagesProgressive } from '@/lib/case-assembler';
import { patchCaseJob } from '@/lib/case-job-store';
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

/** 单个阶段失败（字段缺失/截断/解析/超时）时重试 */
async function withPhaseRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
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

async function buildCasePhasedFallback(
  difficulty: string,
  theme?: string
): Promise<Record<string, unknown>> {
  console.log('[Orchestrator] Falling back to phased framework generation...');
  const base = await withPhaseRetry('base', () => generateCaseBaseWithAI(difficulty));
  const cast = await withPhaseRetry('cast', () => generateCaseCastWithAI(difficulty, base));
  const details = await withPhaseRetry('details', () =>
    generateCaseDetailsWithAI(difficulty, { ...base, ...cast }, theme)
  );
  const merged = mergeCasePhases(base, cast, details);
  return withPhaseRetry('phased polish', () => polishCaseWithAI(difficulty, merged, theme));
}

export async function buildCaseFromPhases(
  difficulty: string,
  theme?: string,
  jobId?: string
): Promise<CaseData> {
  let caseContent: Record<string, unknown>;

  if (jobId) {
    await patchCaseJob(jobId, { progressMessage: 'AI 正在撰写案件框架（4B→8B）…' });
  }

  try {
    console.log('[Orchestrator] Step 1/2: framework (Qwen3.5-4B)');
    console.log('[Orchestrator] Step 2/2: polish (Qwen3-8B)');
    caseContent = await withPhaseRetry('framework + polish', () =>
      generateCaseWithFrameworkAndPolish(difficulty, theme)
    );
  } catch (primaryError) {
    console.warn(
      '[Orchestrator] Framework+polish failed, trying fallbacks:',
      (primaryError as Error)?.message
    );
    try {
      caseContent = await withPhaseRetry('full case', () =>
        generateFullCaseWithAI(difficulty, theme)
      );
    } catch {
      caseContent = await buildCasePhasedFallback(difficulty, theme);
    }
  }

  if (jobId) {
    return buildCaseDataWithImagesProgressive(difficulty, caseContent, jobId);
  }
  return buildCaseDataWithImages(difficulty, caseContent);
}
