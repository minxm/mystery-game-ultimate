import { CaseData, GameProgress, InterrogationMessage, UserStats, CaseEvaluation } from './types';
import { clearCaseStore, loadCaseDataById, saveCaseData } from './case-store';
import {
  caseDataHasMissingCharacterImages,
  mergeCaseCharacterImages,
} from './case-image-merge';
import { computeAchievements, computeStreak } from './achievements';

const STORAGE_KEYS = {
  PROGRESS: 'mystery_progress',
  STATS: 'mystery_stats',
  INTERROGATIONS: 'mystery_interrogations',
  EVALUATIONS: 'mystery_evaluations',
};

export const storage = {
  /** @deprecated 请使用 saveCaseData（IndexedDB，支持 AI 大图） */
  saveCase(caseData: CaseData): void {
    void saveCaseData(caseData);
  },

  /** @deprecated 请使用 loadCaseDataById */
  getCase(_id: string): CaseData | null {
    return null;
  },

  getCases(): CaseData[] {
    return [];
  },

  saveCases(_cases: CaseData[]): void {
    // 案件改存 IndexedDB，不再写入 localStorage
  },

  // 进度存储
  saveProgress(progress: GameProgress): void {
    if (typeof window !== 'undefined') {
      const allProgress = this.getAllProgress();
      const index = allProgress.findIndex(p => p.caseId === progress.caseId);
      if (index >= 0) {
        allProgress[index] = progress;
      } else {
        allProgress.push(progress);
      }
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
    }
  },

  getProgress(caseId: string): GameProgress | null {
    if (typeof window !== 'undefined') {
      const allProgress = this.getAllProgress();
      return allProgress.find(p => p.caseId === caseId) || null;
    }
    return null;
  },

  getAllProgress(): GameProgress[] {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      return data ? JSON.parse(data) : [];
    }
    return [];
  },

  // 统计数据
  getStats(): UserStats {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.STATS);
      return data ? JSON.parse(data) : {
        casesCompleted: 0,
        averageScore: 0,
        perfectSolves: 0,
        achievements: [],
        streak: 0,
      };
    }
    return {
      casesCompleted: 0,
      averageScore: 0,
      perfectSolves: 0,
      achievements: [],
      streak: 0,
    };
  },

  updateStats(score: number): void {
    if (typeof window !== 'undefined') {
      const stats = this.getStats();
      stats.casesCompleted += 1;
      stats.averageScore =
        (stats.averageScore * (stats.casesCompleted - 1) + score) / stats.casesCompleted;
      if (score >= 95) {
        stats.perfectSolves += 1;
      }
      stats.streak = computeStreak(stats.streak, score);
      stats.achievements = computeAchievements({
        casesCompleted: stats.casesCompleted,
        perfectSolves: stats.perfectSolves,
        streak: stats.streak,
        lastScore: score,
      });
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    }
  },

  // 审问记录持久化（key = caseId__suspectId）
  saveInterrogation(caseId: string, suspectId: string, messages: InterrogationMessage[]): void {
    if (typeof window === 'undefined') return;
    const all = this.getAllInterrogations();
    all[`${caseId}__${suspectId}`] = messages;
    localStorage.setItem(STORAGE_KEYS.INTERROGATIONS, JSON.stringify(all));
  },

  getInterrogation(caseId: string, suspectId: string): InterrogationMessage[] {
    if (typeof window === 'undefined') return [];
    const all = this.getAllInterrogations();
    return all[`${caseId}__${suspectId}`] ?? [];
  },

  getAllInterrogations(): Record<string, InterrogationMessage[]> {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(STORAGE_KEYS.INTERROGATIONS);
    return data ? JSON.parse(data) : {};
  },

  saveEvaluation(caseId: string, evaluation: CaseEvaluation, userDeduction?: string): void {
    if (typeof window === 'undefined') return;
    const all = this.getAllEvaluations();
    all[caseId] = {
      ...evaluation,
      userDeduction: userDeduction ?? evaluation.userDeduction,
    };
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(all));
  },

  getEvaluation(caseId: string): CaseEvaluation | null {
    if (typeof window === 'undefined') return null;
    return this.getAllEvaluations()[caseId] ?? null;
  },

  getAllEvaluations(): Record<string, CaseEvaluation> {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
    return data ? JSON.parse(data) : {};
  },

  // 清除数据
  clearAll(): void {
    if (typeof window === 'undefined') return;
    void clearCaseStore();
    localStorage.removeItem('mystery_cases');
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    localStorage.removeItem(STORAGE_KEYS.INTERROGATIONS);
    localStorage.removeItem(STORAGE_KEYS.EVALUATIONS);
  },
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const loadCaseDataInflight = new Map<string, Promise<CaseData | null>>();

/** 从 IndexedDB 加载案件；本地缺图时拉服务端合并更新 */
export async function loadCaseData(caseId: string): Promise<CaseData | null> {
  const existing = loadCaseDataInflight.get(caseId);
  if (existing) return existing;

  const promise = loadCaseDataOnce(caseId).finally(() => {
    loadCaseDataInflight.delete(caseId);
  });

  loadCaseDataInflight.set(caseId, promise);
  return promise;
}

async function loadCaseDataOnce(caseId: string): Promise<CaseData | null> {
  const local = await loadCaseDataById(caseId);

  if (local && !caseDataHasMissingCharacterImages(local)) {
    return local;
  }

  try {
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
    const json = await res.json();
    if (res.ok && json.success && json.caseData) {
      const remote = json.caseData as CaseData;
      const merged = local ? mergeCaseCharacterImages(local, remote) : remote;
      await saveCaseData(merged);
      return merged;
    }
  } catch {
    // 网络失败时继续用本地
  }

  if (local) return local;

  const { fetchCaseFromCloud } = await import('./cloud-sync');
  return fetchCaseFromCloud(caseId);
}

export { saveCaseData, loadCaseDataById, listStoredCases } from './case-store';

/** 根据 URL 参数或缓存查找嫌疑人 */
export function findSuspectByParam(
  suspects: CaseData['suspects'],
  param: string | null
): CaseData['suspects'][number] | null {
  if (!param) return null;

  const decoded = decodeURIComponent(param);
  const byId = suspects.find((s) => s.id === decoded);
  if (byId) return byId;

  const byName = suspects.find((s) => s.name === decoded);
  if (byName) return byName;

  const index = Number.parseInt(decoded.replace(/^s/i, ''), 10) - 1;
  if (!Number.isNaN(index) && index >= 0 && index < suspects.length) {
    return suspects[index];
  }

  return null;
}

export function getSuspectId(
  suspect: CaseData['suspects'][number],
  index: number
): string {
  return suspect.id || `s${index + 1}`;
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  }
  return `${secs}秒`;
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'hard':
      return 'text-orange-400';
    case 'expert':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return '简单';
    case 'medium':
      return '中等';
    case 'hard':
      return '困难';
    case 'expert':
      return '专家';
    default:
      return '未知';
  }
}

export function getScoreRating(
  score: number,
  killerCorrect?: boolean
): {
  rating: string;
  color: string;
  description: string;
} {
  // 指错凶手：无论其他得分多少，都属于"指错人"类评级
  if (killerCorrect === false) {
    if (score >= 30) {
      return {
        rating: '被凶手玩弄',
        color: 'text-orange-400',
        description: '你抓到了一些线索，却被凶手的诡计引向了错误的人...'
      };
    }
    return {
      rating: '冤枉好人',
      color: 'text-red-400',
      description: '真凶逍遥法外，无辜者蒙冤...'
    };
  }

  // 指对凶手（或未提供凶手判定信息时按分数）：最低也是"合格侦探"
  if (score >= 95) {
    return {
      rating: '神探',
      color: 'text-yellow-400',
      description: '完美的推理，福尔摩斯也不过如此！'
    };
  }
  if (score >= 80) {
    return {
      rating: '优秀侦探',
      color: 'text-blue-400',
      description: '出色的推理能力，真相在你手中！'
    };
  }
  if (killerCorrect === true || score >= 60) {
    return {
      rating: '合格侦探',
      color: 'text-green-400',
      description:
        killerCorrect === true
          ? '你成功锁定了真凶，但作案手法或动机还需再推敲！'
          : '基本找到了真相，继续努力！'
    };
  }
  if (score >= 40) {
    return {
      rating: '被凶手玩弄',
      color: 'text-orange-400',
      description: '你被凶手的诡计迷惑了...'
    };
  }
  return {
    rating: '冤枉好人',
    color: 'text-red-400',
    description: '真凶逍遥法外，无辜者蒙冤...'
  };
}

export type InvestigateTab = 'evidence' | 'suspects' | 'timeline';

const INVESTIGATE_TABS = new Set<InvestigateTab>(['evidence', 'suspects', 'timeline']);

function parseInvestigateTab(value: string | null | undefined): InvestigateTab | null {
  if (value && INVESTIGATE_TABS.has(value as InvestigateTab)) {
    return value as InvestigateTab;
  }
  return null;
}

export function saveInvestigateTab(caseId: string, tab: InvestigateTab): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`investigate-tab-${caseId}`, tab);
}

export function resolveInvestigateTab(caseId: string): InvestigateTab {
  if (typeof window !== 'undefined') {
    const urlTab = parseInvestigateTab(new URLSearchParams(window.location.search).get('tab'));
    if (urlTab) return urlTab;
    const stored = parseInvestigateTab(sessionStorage.getItem(`investigate-tab-${caseId}`));
    if (stored) return stored;
  }
  return 'evidence';
}

export function investigatePageUrl(caseId: string, tab: InvestigateTab = 'suspects'): string {
  return `/investigate/${caseId}?tab=${tab}`;
}
