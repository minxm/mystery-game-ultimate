import { createAdminClientSafe } from './admin';
import { CaseData, GameProgress, InterrogationMessage, UserStats } from '@/lib/types';

export async function saveCaseToDb(
  caseData: CaseData,
  userId?: string | null
): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  const { error } = await admin.from('cases').upsert({
    id: caseData.id,
    user_id: userId ?? null,
    title: caseData.title,
    difficulty: caseData.difficulty,
    case_data: caseData,
  });

  if (error) console.warn('[DB] saveCase failed:', error.message);
}

export async function loadCaseFromDb(caseId: string): Promise<CaseData | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data, error } = await admin
    .from('cases')
    .select('case_data')
    .eq('id', caseId)
    .maybeSingle();

  if (error || !data) return null;
  return data.case_data as CaseData;
}

export async function saveProgressToDb(
  userId: string,
  progress: GameProgress
): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  await admin.from('game_progress').upsert({
    user_id: userId,
    case_id: progress.caseId,
    discovered_evidence: progress.discoveredEvidence,
    interrogated_suspects: progress.interrogatedSuspects,
    notes: progress.notes,
    start_time: progress.startTime,
    end_time: progress.endTime ?? null,
    score: progress.score ?? null,
  });
}

export async function loadProgressFromDb(
  userId: string,
  caseId: string
): Promise<GameProgress | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data } = await admin
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .maybeSingle();

  if (!data) return null;
  return {
    caseId: data.case_id,
    discoveredEvidence: data.discovered_evidence ?? [],
    interrogatedSuspects: data.interrogated_suspects ?? [],
    notes: data.notes ?? '',
    startTime: data.start_time,
    endTime: data.end_time ?? undefined,
    score: data.score ?? undefined,
  };
}

export interface EvaluationRecord {
  score: number;
  breakdown: Record<string, number>;
  feedback: string;
  rating: string;
  killerCorrect?: boolean;
  missedClues: string[];
  userDeduction?: string;
}

export async function saveEvaluationToDb(
  userId: string | null,
  caseId: string,
  evaluation: EvaluationRecord
): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  await admin.from('evaluations').insert({
    user_id: userId,
    case_id: caseId,
    score: evaluation.score,
    breakdown: evaluation.breakdown,
    feedback: evaluation.feedback,
    rating: evaluation.rating,
    killer_correct: evaluation.killerCorrect ?? null,
    missed_clues: evaluation.missedClues,
    user_deduction: evaluation.userDeduction ?? null,
  });

  if (userId) {
    await updateUserStats(userId, evaluation.score);
  }
}

async function updateUserStats(userId: string, score: number): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  const { data: stats } = await admin
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const completed = (stats?.cases_completed ?? 0) + 1;
  const avgScore =
    ((stats?.average_score ?? 0) * (completed - 1) + score) / completed;
  const perfectSolves = (stats?.perfect_solves ?? 0) + (score >= 95 ? 1 : 0);

  await admin.from('user_stats').upsert({
    user_id: userId,
    cases_completed: completed,
    average_score: avgScore,
    perfect_solves: perfectSolves,
    streak: stats?.streak ?? 0,
    achievements: stats?.achievements ?? [],
  });
}

export async function loadUserStatsFromDb(userId: string): Promise<UserStats | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data } = await admin
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  return {
    casesCompleted: data.cases_completed,
    averageScore: Number(data.average_score),
    perfectSolves: data.perfect_solves,
    streak: data.streak,
    achievements: data.achievements ?? [],
  };
}

export async function saveInterrogationToDb(
  userId: string,
  caseId: string,
  suspectId: string,
  messages: InterrogationMessage[]
): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  await admin.from('interrogations').upsert({
    user_id: userId,
    case_id: caseId,
    suspect_id: suspectId,
    messages,
  });
}

export async function logActivity(
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  await admin.from('activity_logs').insert({
    user_id: userId,
    action,
    metadata,
  });
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalCases: number;
  avgScore: number;
  bestScore: number;
  perfectSolves: number;
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data, error } = await admin
    .from('leaderboard')
    .select('*')
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    totalCases: row.total_cases,
    avgScore: Number(row.avg_score),
    bestScore: row.best_score,
    perfectSolves: row.perfect_solves,
  }));
}
