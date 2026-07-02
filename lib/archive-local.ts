import type { CaseData, CaseEvaluation, InterrogationMessage } from '@/lib/types';
import { loadCaseData, storage, getScoreRating } from '@/lib/utils';

export interface LocalArchivePayload {
  caseData: CaseData;
  progress: { startTime: number; endTime?: number; score?: number };
  evaluation: CaseEvaluation;
  interrogations: Record<string, InterrogationMessage[]>;
}

/** 从 IndexedDB / localStorage 组装案件档案（云端未同步时的回退） */
export async function loadLocalArchive(caseId: string): Promise<LocalArchivePayload | null> {
  const caseData = await loadCaseData(caseId);
  const progress = storage.getProgress(caseId);
  const storedEval = storage.getEvaluation(caseId);

  const completed =
    storedEval != null || progress?.score != null || progress?.endTime != null;
  if (!caseData || !completed) return null;

  const score = storedEval?.score ?? progress?.score;
  if (score == null) return null;

  const ratingInfo = getScoreRating(score, storedEval?.killerCorrect);
  const evaluation: CaseEvaluation = storedEval ?? {
    score,
    breakdown: {},
    feedback: '暂无详细评语。该案件在本地完成时未保存完整评分记录。',
    rating: ratingInfo.rating,
    missedClues: [],
  };

  const interrogations: Record<string, InterrogationMessage[]> = {};
  const prefix = `${caseId}__`;
  for (const [key, messages] of Object.entries(storage.getAllInterrogations())) {
    if (key.startsWith(prefix)) {
      interrogations[key.slice(prefix.length)] = messages;
    }
  }

  return {
    caseData,
    progress: {
      startTime: progress?.startTime ?? Date.now(),
      endTime: progress?.endTime,
      score: progress?.score ?? score,
    },
    evaluation,
    interrogations,
  };
}
