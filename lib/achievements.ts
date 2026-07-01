import { Achievement } from './types';

export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked'>[] = [
  { id: 'first_case', name: '初出茅庐', description: '完成第一个案件', icon: '🔍' },
  { id: 'perfect_solve', name: '完美推理', description: '单次评分达到 95 分以上', icon: '⭐' },
  { id: 'streak_3', name: '三连胜', description: '连续 3 次推理得分 60 分以上', icon: '🔥' },
  { id: 'streak_7', name: '神探之路', description: '连续 7 次推理得分 60 分以上', icon: '🏆' },
  { id: 'cases_10', name: '资深侦探', description: '累计完成 10 个案件', icon: '🎖️' },
  { id: 'perfect_5', name: '推理大师', description: '累计 5 次完美推理（95+）', icon: '💎' },
];

export function computeAchievements(stats: {
  casesCompleted: number;
  perfectSolves: number;
  streak: number;
  lastScore?: number;
}): Achievement[] {
  const unlockedIds = new Set<string>();

  if (stats.casesCompleted >= 1) unlockedIds.add('first_case');
  if (stats.lastScore !== undefined && stats.lastScore >= 95) unlockedIds.add('perfect_solve');
  if (stats.streak >= 3) unlockedIds.add('streak_3');
  if (stats.streak >= 7) unlockedIds.add('streak_7');
  if (stats.casesCompleted >= 10) unlockedIds.add('cases_10');
  if (stats.perfectSolves >= 5) unlockedIds.add('perfect_5');

  return ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    unlocked: unlockedIds.has(def.id),
  }));
}

/** 根据本次得分更新连胜：60 分以上视为成功 */
export function computeStreak(currentStreak: number, score: number): number {
  return score >= 60 ? currentStreak + 1 : 0;
}
