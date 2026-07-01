import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClientSafe } from './admin';
import { createClientSafe } from './server';
import { CaseData, GameProgress, InterrogationMessage, UserStats } from '@/lib/types';
import { computeAchievements, computeStreak } from '@/lib/achievements';

function isPermissionDenied(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || (error.message?.includes('permission denied') ?? false);
}

async function upsertCaseRow(
  client: SupabaseClient,
  caseData: CaseData,
  userId: string | null | undefined,
  options?: { isPublic?: boolean }
) {
  return client.from('cases').upsert({
    id: caseData.id,
    user_id: userId ?? null,
    title: caseData.title,
    difficulty: caseData.difficulty,
    case_data: caseData,
    is_public: options?.isPublic ?? true,
  });
}

export async function saveCaseToDb(
  caseData: CaseData,
  userId?: string | null,
  options?: { isPublic?: boolean }
): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (admin) {
    const { error } = await upsertCaseRow(admin, caseData, userId, options);
    if (!error) return true;
    console.warn('[DB] saveCase failed (admin):', error.message);
    if (!isPermissionDenied(error) || !userId) return false;
  }

  if (userId) {
    const supabase = await createClientSafe();
    if (supabase) {
      const { error } = await upsertCaseRow(supabase, caseData, userId, options);
      if (!error) return true;
      console.warn('[DB] saveCase failed (user session):', error.message);
    }
  }

  return false;
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

export async function loadCaseForUser(
  caseId: string,
  userId: string
): Promise<CaseData | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data, error } = await admin
    .from('cases')
    .select('case_data')
    .eq('id', caseId)
    .eq('user_id', userId)
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
  const streak = computeStreak(stats?.streak ?? 0, score);
  const achievements = computeAchievements({
    casesCompleted: completed,
    perfectSolves,
    streak,
    lastScore: score,
  });

  await admin.from('user_stats').upsert({
    user_id: userId,
    cases_completed: completed,
    average_score: avgScore,
    perfect_solves: perfectSolves,
    streak,
    achievements,
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

export async function fetchUserCasesFromDb(
  userId: string,
  limit = 20
): Promise<CaseData[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data, error } = await admin
    .from('cases')
    .select('case_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => row.case_data as CaseData);
}

export interface RecentCaseItem {
  caseData: CaseData;
  progress: GameProgress | null;
}

/** 推荐案件：数据库最新案件（登录/游客共用） */
export async function fetchRecommendedCases(limit = 5): Promise<CaseData[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data, error } = await admin
    .from('cases')
    .select('case_data')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => row.case_data as CaseData);
}

export interface PlayedCaseItem {
  caseData: CaseData;
  progress: GameProgress;
  evaluation: EvaluationRecord | null;
}

/** 登录用户玩过的案件（含进度与评分） */
export async function fetchUserPlayedCases(
  userId: string,
  limit = 5
): Promise<PlayedCaseItem[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data: progressRows } = await admin
    .from('game_progress')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (!progressRows?.length) return [];

  const caseIds = progressRows.map((r) => r.case_id as string);
  const [{ data: caseRows }, { data: evalRows }] = await Promise.all([
    admin.from('cases').select('id, case_data').in('id', caseIds),
    admin
      .from('evaluations')
      .select('*')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .order('created_at', { ascending: false }),
  ]);

  const caseMap = new Map(
    (caseRows ?? []).map((r) => [r.id as string, r.case_data as CaseData])
  );

  const evalMap = new Map<string, EvaluationRecord>();
  for (const row of evalRows ?? []) {
    const cid = row.case_id as string;
    if (evalMap.has(cid)) continue;
    evalMap.set(cid, {
      score: row.score as number,
      breakdown: (row.breakdown as Record<string, number>) ?? {},
      feedback: (row.feedback as string) ?? '',
      rating: (row.rating as string) ?? '',
      killerCorrect: row.killer_correct as boolean | undefined,
      missedClues: (row.missed_clues as string[]) ?? [],
      userDeduction: (row.user_deduction as string) ?? undefined,
    });
  }

  const items: PlayedCaseItem[] = [];
  for (const row of progressRows) {
    const caseData = caseMap.get(row.case_id as string);
    if (!caseData) continue;
    items.push({
      caseData,
      progress: {
        caseId: row.case_id as string,
        discoveredEvidence: (row.discovered_evidence as string[]) ?? [],
        interrogatedSuspects: (row.interrogated_suspects as string[]) ?? [],
        notes: (row.notes as string) ?? '',
        startTime: row.start_time as number,
        endTime: (row.end_time as number) ?? undefined,
        score: (row.score as number) ?? undefined,
      },
      evaluation: evalMap.get(row.case_id as string) ?? null,
    });
  }
  return items;
}

export interface CaseArchiveData {
  caseData: CaseData;
  progress: GameProgress;
  evaluation: EvaluationRecord;
  interrogations: Record<string, InterrogationMessage[]>;
}

/** 案件档案：已完成案件的完整回顾数据 */
export async function fetchCaseArchive(
  userId: string,
  caseId: string
): Promise<CaseArchiveData | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const [caseData, progress, evalRow, interrogationRows] = await Promise.all([
    loadCaseFromDb(caseId),
    loadProgressFromDb(userId, caseId),
    admin
      .from('evaluations')
      .select('*')
      .eq('user_id', userId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('interrogations')
      .select('suspect_id, messages')
      .eq('user_id', userId)
      .eq('case_id', caseId),
  ]);

  if (!caseData || !progress || progress.score === undefined || !evalRow.data) {
    return null;
  }

  const interrogations: Record<string, InterrogationMessage[]> = {};
  for (const row of interrogationRows.data ?? []) {
    interrogations[row.suspect_id as string] = row.messages as InterrogationMessage[];
  }

  const ev = evalRow.data;
  return {
    caseData,
    progress,
    evaluation: {
      score: ev.score as number,
      breakdown: (ev.breakdown as Record<string, number>) ?? {},
      feedback: (ev.feedback as string) ?? '',
      rating: (ev.rating as string) ?? '',
      killerCorrect: ev.killer_correct as boolean | undefined,
      missedClues: (ev.missed_clues as string[]) ?? [],
      userDeduction: (ev.user_deduction as string) ?? undefined,
    },
    interrogations,
  };
}

/** 登录用户最近案件（数据库 cases + game_progress） */
export async function fetchRecentUserCases(
  userId: string,
  limit = 5
): Promise<RecentCaseItem[]> {
  const [cases, progressList] = await Promise.all([
    fetchUserCasesFromDb(userId, limit),
    fetchUserProgressListFromDb(userId),
  ]);
  const progressMap = new Map(progressList.map((p) => [p.caseId, p]));
  return cases.map((caseData) => ({
    caseData,
    progress: progressMap.get(caseData.id) ?? null,
  }));
}

export async function fetchUserProgressListFromDb(
  userId: string
): Promise<GameProgress[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data } = await admin
    .from('game_progress')
    .select('*')
    .eq('user_id', userId);

  if (!data) return [];
  return data.map((row) => ({
    caseId: row.case_id,
    discoveredEvidence: row.discovered_evidence ?? [],
    interrogatedSuspects: row.interrogated_suspects ?? [],
    notes: row.notes ?? '',
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    score: row.score ?? undefined,
  }));
}

export async function fetchUserInterrogationsFromDb(
  userId: string
): Promise<Record<string, InterrogationMessage[]>> {
  const admin = createAdminClientSafe();
  if (!admin) return {};

  const { data } = await admin
    .from('interrogations')
    .select('case_id, suspect_id, messages')
    .eq('user_id', userId);

  if (!data) return {};
  const result: Record<string, InterrogationMessage[]> = {};
  for (const row of data) {
    result[`${row.case_id}__${row.suspect_id}`] = row.messages as InterrogationMessage[];
  }
  return result;
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

// ── 分享 ──

export async function createShareToken(caseId: string, userId: string): Promise<string | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const token = `${caseId.slice(-8)}-${Date.now().toString(36)}`;
  const { error } = await admin
    .from('cases')
    .update({ share_token: token, is_public: true })
    .eq('id', caseId)
    .eq('user_id', userId);

  if (error) {
    console.warn('[DB] createShareToken failed:', error.message);
    return null;
  }
  return token;
}

export async function loadCaseByShareToken(token: string): Promise<CaseData | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const { data, error } = await admin
    .from('cases')
    .select('case_data, id')
    .eq('share_token', token)
    .eq('is_public', true)
    .maybeSingle();

  if (error || !data) return null;

  return data.case_data as CaseData;
}

export async function incrementCasePlayCount(caseId: string): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;
  const { data } = await admin.from('cases').select('play_count').eq('id', caseId).maybeSingle();
  await admin
    .from('cases')
    .update({ play_count: (data?.play_count ?? 0) + 1 })
    .eq('id', caseId);
}

// ── 历史记录 ──

export interface HistoryEntry {
  id: string;
  caseId: string;
  caseTitle: string;
  score: number;
  rating: string;
  killerCorrect: boolean | null;
  createdAt: string;
}

export async function fetchUserHistory(
  userId: string,
  limit = 30
): Promise<HistoryEntry[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data } = await admin
    .from('evaluations')
    .select('id, case_id, score, rating, killer_correct, created_at, cases(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => {
    const cases = row.cases as { title: string } | { title: string }[] | null;
    const title = Array.isArray(cases) ? cases[0]?.title : cases?.title;
    return {
      id: row.id,
      caseId: row.case_id,
      caseTitle: title ?? '未知案件',
      score: row.score,
      rating: row.rating ?? '',
      killerCorrect: row.killer_correct,
      createdAt: row.created_at,
    };
  });
}

// ── 评论 / 收藏 / 举报 ──

export interface CaseComment {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export async function fetchCaseComments(caseId: string, limit = 50): Promise<CaseComment[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data } = await admin
    .from('case_comments')
    .select('id, user_id, content, created_at, profiles(display_name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => {
    const profile = row.profiles as { display_name: string } | { display_name: string }[] | null;
    const name = Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name;
    return {
      id: row.id,
      userId: row.user_id,
      displayName: name ?? '匿名侦探',
      content: row.content,
      createdAt: row.created_at,
    };
  });
}

export async function addCaseComment(
  caseId: string,
  userId: string,
  content: string
): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  const { error } = await admin.from('case_comments').insert({
    case_id: caseId,
    user_id: userId,
    content: content.trim().slice(0, 500),
  });
  return !error;
}

export async function toggleCaseFavorite(
  caseId: string,
  userId: string
): Promise<{ favorited: boolean }> {
  const admin = createAdminClientSafe();
  if (!admin) return { favorited: false };

  const { data: existing } = await admin
    .from('case_favorites')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .maybeSingle();

  if (existing) {
    await admin.from('case_favorites').delete().eq('user_id', userId).eq('case_id', caseId);
    return { favorited: false };
  }

  await admin.from('case_favorites').insert({ user_id: userId, case_id: caseId });
  return { favorited: true };
}

export async function isCaseFavorited(caseId: string, userId: string): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  const { data } = await admin
    .from('case_favorites')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .maybeSingle();

  return !!data;
}

export async function reportCase(
  caseId: string,
  userId: string | null,
  reason: string,
  detail?: string
): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  const { error } = await admin.from('case_reports').insert({
    case_id: caseId,
    user_id: userId,
    reason: reason.trim().slice(0, 200),
    detail: detail?.trim().slice(0, 500) ?? null,
  });
  return !error;
}

// ── AI 监控 ──

export interface MonitorStats {
  pendingJobs: number;
  recentPending: number;
  aiCallsLastHour: number;
  avgLatencyMs: number;
  tokensLastHour: number;
  inventory: { difficulty: string; available: number; claimed: number }[];
  recentErrors: { operation: string; model: string; errorMessage: string; createdAt: string }[];
}

export async function fetchMonitorStats(): Promise<MonitorStats | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const [statsRes, inventoryRes, errorsRes] = await Promise.all([
    admin.from('ai_monitor_stats').select('*').maybeSingle(),
    admin.from('case_inventory_stats').select('*'),
    admin
      .from('ai_call_logs')
      .select('operation, model, error_message, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const stats = statsRes.data;
  return {
    pendingJobs: stats?.pending_jobs ?? 0,
    recentPending: stats?.recent_pending ?? 0,
    aiCallsLastHour: stats?.ai_calls_last_hour ?? 0,
    avgLatencyMs: stats?.avg_latency_ms ?? 0,
    tokensLastHour: Number(stats?.tokens_last_hour ?? 0),
    inventory: (inventoryRes.data ?? []).map((r) => ({
      difficulty: r.difficulty,
      available: r.available ?? 0,
      claimed: r.claimed ?? 0,
    })),
    recentErrors: (errorsRes.data ?? []).map((r) => ({
      operation: r.operation,
      model: r.model,
      errorMessage: r.error_message ?? '',
      createdAt: r.created_at,
    })),
  };
}

export async function fetchAiCallLogs(limit = 50) {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data } = await admin
    .from('ai_call_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
