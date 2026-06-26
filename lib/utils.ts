import { CaseData, GameProgress, InterrogationMessage, UserStats } from './types';

const STORAGE_KEYS = {
  CASES: 'mystery_cases',
  PROGRESS: 'mystery_progress',
  STATS: 'mystery_stats',
  INTERROGATIONS: 'mystery_interrogations',
};

export const storage = {
  // 案件存储
  saveCases(cases: CaseData[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
    }
  },

  getCases(): CaseData[] {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEYS.CASES);
      return data ? JSON.parse(data) : [];
    }
    return [];
  },

  saveCase(caseData: CaseData): void {
    const cases = this.getCases();
    const index = cases.findIndex(c => c.id === caseData.id);
    if (index >= 0) {
      cases[index] = caseData;
    } else {
      cases.push(caseData);
    }
    this.saveCases(cases);
  },

  getCase(id: string): CaseData | null {
    const cases = this.getCases();
    return cases.find(c => c.id === id) || null;
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

  // 清除数据
  clearAll(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CASES);
      localStorage.removeItem(STORAGE_KEYS.PROGRESS);
      localStorage.removeItem(STORAGE_KEYS.STATS);
      localStorage.removeItem(STORAGE_KEYS.INTERROGATIONS);
    }
  },
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** 从 localStorage 或 sessionStorage 加载案件 */
export function loadCaseData(caseId: string): CaseData | null {
  let data = storage.getCase(caseId);

  if (!data && typeof window !== 'undefined') {
    const sessionData = sessionStorage.getItem('currentCase');
    if (sessionData) {
      const parsed = JSON.parse(sessionData) as CaseData;
      if (parsed.id === caseId) {
        data = parsed;
        storage.saveCase(parsed);
      }
    }
  }

  return data;
}

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
