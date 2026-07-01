/** 客户端云同步工具（登录用户自动同步到 Supabase） */
import { CaseData, GameProgress, InterrogationMessage, UserStats } from './types';
import { saveCaseData } from './case-store';
import { storage } from './utils';
import { computeAchievements } from './achievements';

export interface CloudPullData {
  cases: CaseData[];
  progress: GameProgress[];
  interrogations: Record<string, InterrogationMessage[]>;
  stats: UserStats | null;
}

export async function syncProgress(progress: GameProgress): Promise<void> {
  try {
    await fetch('/api/sync/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    });
  } catch {
    // 静默失败，本地存储仍可用
  }
}

export async function syncEvaluation(
  caseId: string,
  evaluation: Record<string, unknown>,
  userDeduction?: string
): Promise<void> {
  try {
    await fetch('/api/sync/evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, evaluation, userDeduction }),
    });
  } catch {
    // 静默失败
  }
}

export async function syncInterrogation(
  caseId: string,
  suspectId: string,
  messages: InterrogationMessage[]
): Promise<void> {
  try {
    await fetch('/api/sync/interrogation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, suspectId, messages }),
    });
  } catch {
    // 静默失败
  }
}

/** 从云端拉取用户数据 */
export async function pullCloudData(): Promise<CloudPullData | null> {
  try {
    const res = await fetch('/api/sync/pull');
    const json = await res.json();
    if (!json.success || !json.synced || !json.data) return null;
    return json.data as CloudPullData;
  } catch {
    return null;
  }
}

/** 将云端数据合并到本地 IndexedDB / localStorage */
export async function mergeCloudDataIntoLocal(data: CloudPullData): Promise<void> {
  for (const caseData of data.cases) {
    await saveCaseData(caseData);
  }

  for (const cloudProgress of data.progress) {
    const local = storage.getProgress(cloudProgress.caseId);
    if (!local) {
      storage.saveProgress(cloudProgress);
      continue;
    }
    const cloudScore = cloudProgress.score ?? 0;
    const localScore = local.score ?? 0;
    const cloudEvidence = cloudProgress.discoveredEvidence.length;
    const localEvidence = local.discoveredEvidence.length;
    if (
      cloudScore > localScore ||
      cloudEvidence > localEvidence ||
      (cloudProgress.endTime && !local.endTime)
    ) {
      storage.saveProgress(cloudProgress);
    }
  }

  const localInterrogations = storage.getAllInterrogations();
  for (const [key, messages] of Object.entries(data.interrogations)) {
    const local = localInterrogations[key] ?? [];
    if (messages.length > local.length) {
      const [caseId, suspectId] = key.split('__');
      storage.saveInterrogation(caseId, suspectId, messages);
    }
  }

  if (data.stats) {
    const local = storage.getStats();
    const merged: UserStats = {
      casesCompleted: Math.max(local.casesCompleted, data.stats.casesCompleted),
      averageScore:
        data.stats.casesCompleted >= local.casesCompleted
          ? data.stats.averageScore
          : local.averageScore,
      perfectSolves: Math.max(local.perfectSolves, data.stats.perfectSolves),
      streak: Math.max(local.streak, data.stats.streak),
      achievements: computeAchievements({
        casesCompleted: Math.max(local.casesCompleted, data.stats.casesCompleted),
        perfectSolves: Math.max(local.perfectSolves, data.stats.perfectSolves),
        streak: Math.max(local.streak, data.stats.streak),
      }),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('mystery_stats', JSON.stringify(merged));
    }
  }
}

/** 登录后拉取并合并云端数据 */
export async function pullAndMergeCloudData(): Promise<boolean> {
  const data = await pullCloudData();
  if (!data) return false;
  await mergeCloudDataIntoLocal(data);
  return true;
}

/** 本地未命中时从云端加载单个案件 */
export async function fetchCaseFromCloud(caseId: string): Promise<CaseData | null> {
  try {
    const res = await fetch(`/api/sync/case?caseId=${encodeURIComponent(caseId)}`);
    const json = await res.json();
    if (!json.success || !json.case) return null;
    const caseData = json.case as CaseData;
    await saveCaseData(caseData);
    return caseData;
  } catch {
    return null;
  }
}
