import { CaseData, GameProgress, UserStats } from './types';

const STORAGE_KEYS = {
  CASES: 'mystery_cases',
  PROGRESS: 'mystery_progress',
  STATS: 'mystery_stats',
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

  // 清除数据
  clearAll(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CASES);
      localStorage.removeItem(STORAGE_KEYS.PROGRESS);
      localStorage.removeItem(STORAGE_KEYS.STATS);
    }
  },
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

export function getScoreRating(score: number): {
  rating: string;
  color: string;
  description: string;
} {
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
  if (score >= 60) {
    return {
      rating: '合格侦探',
      color: 'text-green-400',
      description: '基本找到了真相，继续努力！'
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
