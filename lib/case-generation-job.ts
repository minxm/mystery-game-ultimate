import { buildCaseFromPhases } from '@/lib/generate-case-orchestrator';
import { setCaseJob } from '@/lib/case-job-store';
import { createFallbackCase } from '@/lib/fallback-case';
import { uploadCaseImages } from '@/lib/supabase/storage';
import { shareCaseToInventory } from '@/lib/case-inventory';
import { logActivity } from '@/lib/supabase/database';
import { setAiRequestContext, clearAiRequestContext } from '@/lib/ai-service';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface CaseGenerationJobOptions {
  /** 0 表示不设总超时（本地 worker 推荐） */
  timeoutMs?: number;
  userId?: string | null;
}

/**
 * 执行案件生成任务并写入 job store。
 * Netlify 后台函数与本地 /api/generate-case/worker 共用。
 */
export async function executeCaseGenerationJob(
  jobId: string,
  difficulty: string,
  options: CaseGenerationJobOptions = {}
): Promise<void> {
  const { timeoutMs = 0, userId = null } = options;
  const jobMeta = { userId, difficulty };

  console.log('[CaseJob] Starting generation:', jobId, 'difficulty:', difficulty);

  setAiRequestContext({ userId, jobId, metadata: { difficulty } });

  try {
    const buildPromise = buildCaseFromPhases(difficulty, undefined, jobId);
    let caseData =
      timeoutMs > 0
        ? await withTimeout(buildPromise, timeoutMs, 'buildCaseFromPhases')
        : await buildPromise;

    caseData = await uploadCaseImages(caseData);
    const shared = await shareCaseToInventory(caseData, difficulty, userId);
    if (!shared) {
      throw new Error('案件入库失败');
    }
    await logActivity(userId, 'case_generated', { caseId: caseData.id, difficulty });

    await setCaseJob(jobId, {
      status: 'done',
      stage: 'done',
      caseData,
      createdAt: Date.now(),
    }, jobMeta);
    console.log('[CaseJob] Completed:', jobId, caseData.title);
  } catch (error: unknown) {
    const message = (error as Error)?.message || '案件生成失败';
    console.error('[CaseJob] Generation failed, using fallback:', jobId, message);

    try {
      const fallbackCase = createFallbackCase(difficulty);
      await shareCaseToInventory(fallbackCase, difficulty, userId);
      await setCaseJob(jobId, {
        status: 'done',
        stage: 'done',
        caseData: fallbackCase,
        error: message,
        createdAt: Date.now(),
      }, jobMeta);
      console.log('[CaseJob] Fallback served:', jobId, fallbackCase.title);
    } catch (storeError: unknown) {
      console.error('[CaseJob] Failed to store fallback:', (storeError as Error)?.message);
      await setCaseJob(jobId, {
        status: 'error',
        stage: 'done',
        error: message,
        createdAt: Date.now(),
      }, jobMeta);
    }
  } finally {
    clearAiRequestContext();
  }
}
