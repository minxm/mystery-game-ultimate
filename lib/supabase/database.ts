import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClientSafe } from './admin';
import { createClientSafe } from './server';
import { CaseData, GameProgress, InterrogationMessage, UserStats } from '@/lib/types';
import { computeAchievements, computeStreak } from '@/lib/achievements';
import { getScenePlaceholder } from '@/lib/placeholder';

function isPermissionDenied(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || (error.message?.includes('permission denied') ?? false);
}

async function upsertCaseRow(
  client: SupabaseClient,
  caseData: CaseData,
  userId: string | null | undefined,
  options?: { isPublic?: boolean }
) {
  const sceneImageUrl = caseData.sceneImageUrl?.startsWith('http')
    ? caseData.sceneImageUrl
    : null;

  return client.from('cases').upsert({
    id: caseData.id,
    user_id: userId ?? null,
    title: caseData.title,
    difficulty: caseData.difficulty,
    setting: caseData.setting ?? '',
    case_data: caseData,
    scene_image_url: sceneImageUrl,
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

  const { data: rows } = await admin
    .from('evaluations')
    .select('score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!rows?.length) {
    return {
      casesCompleted: 0,
      averageScore: 0,
      perfectSolves: 0,
      streak: 0,
      achievements: computeAchievements({
        casesCompleted: 0,
        perfectSolves: 0,
        streak: 0,
      }),
    };
  }

  const scores = rows.map((row) => row.score as number);
  const casesCompleted = scores.length;
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / casesCompleted;
  const perfectSolves = scores.filter((score) => score >= 95).length;

  let streak = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] >= 60) streak++;
    else break;
  }

  const lastScore = scores[scores.length - 1];
  return {
    casesCompleted,
    averageScore,
    perfectSolves,
    streak,
    achievements: computeAchievements({
      casesCompleted,
      perfectSolves,
      streak,
      lastScore,
    }),
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

const CASE_LIST_SELECT = 'id, title, difficulty, setting, scene_image_url, created_at';

type CaseListRow = {
  id: string;
  title: string;
  difficulty: CaseData['difficulty'];
  setting?: string | null;
  scene_image_url?: string | null;
  sceneImageUrl?: string | null;
  created_at?: string | null;
  createdAt?: number | null;
};

function resolveListSceneImageUrl(
  url: string | null | undefined,
  title: string,
  setting: string
): string {
  if (url?.startsWith('http')) return url;
  return getScenePlaceholder(title || setting || 'scene');
}

function buildListCaseData(row: CaseListRow): CaseData {
  const setting = row.setting ?? '';
  const sceneImageUrl = resolveListSceneImageUrl(
    row.scene_image_url ?? row.sceneImageUrl,
    row.title,
    setting
  );

  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    setting,
    sceneImageUrl,
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : typeof row.createdAt === 'number'
        ? row.createdAt
        : Date.now(),
    victim: { name: '', age: 0, occupation: '', background: '' },
    deathMethod: '',
    sceneDescription: '',
    suspects: [],
    evidence: [],
    timeline: [],
    truth: { killer: '', method: '', motive: '', process: [], keyClues: [] },
    redHerrings: [],
  };
}

function mapListRows(rows: CaseListRow[]): Map<string, CaseData> {
  return new Map(rows.map((row) => [row.id, buildListCaseData(row)]));
}

async function fetchCaseListSummariesByIds(caseIds: string[]): Promise<Map<string, CaseData>> {
  const admin = createAdminClientSafe();
  if (!admin || caseIds.length === 0) return new Map();

  const primary = await admin.from('cases').select(CASE_LIST_SELECT).in('id', caseIds);
  if (!primary.error) {
    return mapListRows((primary.data ?? []) as CaseListRow[]);
  }

  // setting 列未迁移时，仍不读取 case_data JSON
  if (!primary.error.message.includes('setting')) {
    console.error('[fetchCaseListSummariesByIds] failed:', primary.error.message);
    return new Map();
  }

  const legacySelect = 'id, title, difficulty, scene_image_url, created_at';
  const legacy = await admin.from('cases').select(legacySelect).in('id', caseIds);
  if (legacy.error) {
    console.error('[fetchCaseListSummariesByIds] legacy failed:', legacy.error.message);
    return new Map();
  }

  return mapListRows((legacy.data ?? []) as CaseListRow[]);
}

/** 推荐案件：案例库可用库存（登录/游客共用） */
export async function fetchRecommendedCases(limit = 5): Promise<CaseData[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data: inventoryRows, error: inventoryError } = await admin
    .from('case_inventory')
    .select('case_id')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (inventoryError) {
    console.error('[fetchRecommendedCases] inventory query failed:', inventoryError.message);
    return [];
  }
  if (!inventoryRows?.length) return [];

  const caseIds = inventoryRows.map((row) => row.case_id as string);
  const caseMap = await fetchCaseListSummariesByIds(caseIds);

  return caseIds
    .map((id) => caseMap.get(id) ?? null)
    .filter((item): item is CaseData => item !== null);
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
    .select('case_id, discovered_evidence, interrogated_suspects, notes, start_time, end_time, score')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (!progressRows?.length) return [];

  const caseIds = progressRows.map((r) => r.case_id as string);
  const [{ data: evalRows }, caseMap] = await Promise.all([
    admin
      .from('evaluations')
      .select('case_id, score, breakdown, feedback, rating, killer_correct, missed_clues, user_deduction')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .order('created_at', { ascending: false }),
    fetchCaseListSummariesByIds(caseIds),
  ]);

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

  if (!caseData) return null;

  const ev = evalRow.data;
  const hasEval = !!ev;
  const hasProgressScore = progress?.score !== undefined;

  if (!hasEval && !hasProgressScore) {
    return null;
  }

  const interrogations: Record<string, InterrogationMessage[]> = {};
  for (const row of interrogationRows.data ?? []) {
    interrogations[row.suspect_id as string] = row.messages as InterrogationMessage[];
  }

  const evaluation: EvaluationRecord = hasEval
    ? {
        score: ev!.score as number,
        breakdown: (ev!.breakdown as Record<string, number>) ?? {},
        feedback: (ev!.feedback as string) ?? '',
        rating: (ev!.rating as string) ?? '',
        killerCorrect: ev!.killer_correct as boolean | undefined,
        missedClues: (ev!.missed_clues as string[]) ?? [],
        userDeduction: (ev!.user_deduction as string) ?? undefined,
      }
    : {
        score: progress!.score!,
        breakdown: {},
        feedback: '',
        rating: '',
        missedClues: [],
      };

  const finalProgress: GameProgress =
    progress ??
    ({
      caseId,
      discoveredEvidence: [],
      interrogatedSuspects: [],
      notes: '',
      startTime: Date.now(),
      endTime: Date.now(),
      score: evaluation.score,
    } as GameProgress);

  if (finalProgress.score === undefined) {
    finalProgress.score = evaluation.score;
  }

  return {
    caseData,
    progress: finalProgress,
    evaluation,
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
  return data.map(mapGameProgressRow);
}

export async function fetchUserProgressForCaseIds(
  userId: string,
  caseIds: string[]
): Promise<GameProgress[]> {
  const admin = createAdminClientSafe();
  if (!admin || caseIds.length === 0) return [];

  const { data } = await admin
    .from('game_progress')
    .select('case_id, discovered_evidence, interrogated_suspects, notes, start_time, end_time, score')
    .eq('user_id', userId)
    .in('case_id', caseIds);

  if (!data) return [];
  return data.map(mapGameProgressRow);
}

/** 批量查询用户对若干案件的最新评分 */
export async function fetchUserEvaluationsForCaseIds(
  userId: string,
  caseIds: string[]
): Promise<{ caseId: string; score: number }[]> {
  const admin = createAdminClientSafe();
  if (!admin || caseIds.length === 0) return [];

  const { data } = await admin
    .from('evaluations')
    .select('case_id, score, created_at')
    .eq('user_id', userId)
    .in('case_id', caseIds)
    .order('created_at', { ascending: false });

  if (!data) return [];

  const seen = new Set<string>();
  const result: { caseId: string; score: number }[] = [];
  for (const row of data) {
    const caseId = row.case_id as string;
    if (seen.has(caseId)) continue;
    seen.add(caseId);
    result.push({ caseId, score: row.score as number });
  }
  return result;
}

function mapGameProgressRow(row: {
  case_id: string;
  discovered_evidence: string[] | null;
  interrogated_suspects: string[] | null;
  notes: string | null;
  start_time: number;
  end_time: number | null;
  score: number | null;
}): GameProgress {
  return {
    caseId: row.case_id,
    discoveredEvidence: row.discovered_evidence ?? [],
    interrogatedSuspects: row.interrogated_suspects ?? [],
    notes: row.notes ?? '',
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    score: row.score ?? undefined,
  };
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

export async function createShareToken(caseId: string, _userId: string): Promise<string | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const token = `${caseId.slice(-8)}-${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from('cases')
    .update({ share_token: token, is_public: true })
    .eq('id', caseId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('[DB] createShareToken failed:', error.message);
    return null;
  }
  if (!data) {
    console.warn('[DB] createShareToken: case not found in DB', caseId);
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

  const caseData = data.case_data as CaseData;
  return { ...caseData, id: data.id ?? caseData.id };
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
  score: number | null;
  rating: string;
  killerCorrect: boolean | null;
  createdAt: string;
  status: 'in_progress' | 'completed';
}

export async function fetchUserHistory(
  userId: string,
  limit = 30
): Promise<HistoryEntry[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const [evalRes, progressRes] = await Promise.all([
    admin
      .from('evaluations')
      .select('id, case_id, score, rating, killer_correct, created_at, cases(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('game_progress')
      .select('id, case_id, start_time, updated_at, end_time, cases(title)')
      .eq('user_id', userId)
      .is('end_time', null)
      .order('updated_at', { ascending: false })
      .limit(limit),
  ]);

  const completed = (evalRes.data ?? []).map((row) => {
    const cases = row.cases as { title: string } | { title: string }[] | null;
    const title = Array.isArray(cases) ? cases[0]?.title : cases?.title;
    return {
      id: row.id as string,
      caseId: row.case_id as string,
      caseTitle: title ?? '未知案件',
      score: row.score as number,
      rating: (row.rating as string) ?? '',
      killerCorrect: row.killer_correct as boolean | null,
      createdAt: row.created_at as string,
      status: 'completed' as const,
    };
  });

  const completedCaseIds = new Set(completed.map((entry) => entry.caseId));

  const inProgress = (progressRes.data ?? [])
    .filter((row) => !completedCaseIds.has(row.case_id as string))
    .map((row) => {
      const cases = row.cases as { title: string } | { title: string }[] | null;
      const title = Array.isArray(cases) ? cases[0]?.title : cases?.title;
      return {
        id: row.id as string,
        caseId: row.case_id as string,
        caseTitle: title ?? '未知案件',
        score: null,
        rating: '',
        killerCorrect: null,
        createdAt: (row.updated_at as string) ?? new Date(row.start_time as number).toISOString(),
        status: 'in_progress' as const,
      };
    });

  return [...inProgress, ...completed]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
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

export interface FavoriteCaseItem {
  caseId: string;
  caseData: CaseData;
  favoritedAt: string;
  score: number | null;
  completed: boolean;
}

/** 用户收藏的案件列表 */
export async function fetchUserFavoriteCases(
  userId: string,
  limit = 50
): Promise<FavoriteCaseItem[]> {
  const admin = createAdminClientSafe();
  if (!admin) return [];

  const { data: favRows } = await admin
    .from('case_favorites')
    .select('case_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!favRows?.length) return [];

  const caseIds = favRows.map((r) => r.case_id as string);
  const [caseMap, { data: progressRows }, { data: evalRows }] = await Promise.all([
    fetchCaseListSummariesByIds(caseIds),
    admin
      .from('game_progress')
      .select('case_id, score, end_time')
      .eq('user_id', userId)
      .in('case_id', caseIds),
    admin
      .from('evaluations')
      .select('case_id, score')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .order('created_at', { ascending: false }),
  ]);

  const progressMap = new Map<string, { score: number | null; completed: boolean }>();
  for (const row of progressRows ?? []) {
    const cid = row.case_id as string;
    progressMap.set(cid, {
      score: (row.score as number | null) ?? null,
      completed: row.end_time != null || row.score != null,
    });
  }

  const evalMap = new Map<string, number>();
  for (const row of evalRows ?? []) {
    const cid = row.case_id as string;
    if (!evalMap.has(cid)) evalMap.set(cid, row.score as number);
  }

  const items: FavoriteCaseItem[] = [];
  for (const row of favRows) {
    const caseId = row.case_id as string;
    const caseData = caseMap.get(caseId);
    if (!caseData) continue;
    const progress = progressMap.get(caseId);
    const evalScore = evalMap.get(caseId);
    const score = evalScore ?? progress?.score ?? null;
    const completed = evalScore != null || (progress?.completed ?? false);
    items.push({
      caseId,
      caseData,
      favoritedAt: row.created_at as string,
      score,
      completed,
    });
  }
  return items;
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

export interface MonitorInventoryClaimer {
  userId: string | null;
  displayName: string | null;
  claimedAt: string;
}

export interface MonitorInventoryItem {
  id: string;
  caseId: string;
  title: string;
  difficulty: string;
  status: string;
  claimers: MonitorInventoryClaimer[];
  createdAt: string;
  playCount: number;
}

export interface MonitorStats {
  pendingJobs: number;
  recentPending: number;
  aiCallsLastHour: number;
  avgLatencyMs: number;
  tokensLastHour: number;
  inventory: MonitorInventoryItem[];
  recentErrors: { operation: string; model: string; errorMessage: string; createdAt: string }[];
}

function unwrapJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function buildInventoryClaimersMap(
  logs: {
    user_id: string | null;
    metadata: unknown;
    created_at: string;
    profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  }[]
): Map<string, MonitorInventoryClaimer[]> {
  const claimersByCaseId = new Map<string, MonitorInventoryClaimer[]>();

  for (const log of logs) {
    const caseId = (log.metadata as { caseId?: string } | null)?.caseId;
    if (!caseId) continue;

    const userId = log.user_id ?? null;
    const list = claimersByCaseId.get(caseId) ?? [];
    if (userId && list.some((c) => c.userId === userId)) continue;

    const profile = unwrapJoinedRow(log.profiles);
    list.push({
      userId,
      displayName: profile?.display_name ?? null,
      claimedAt: log.created_at,
    });
    claimersByCaseId.set(caseId, list);
  }

  return claimersByCaseId;
}

function mergeInventoryClaimers(
  fromLogs: MonitorInventoryClaimer[],
  claimedBy: string | null,
  claimedByName: string | null,
  claimedAt: string | null
): MonitorInventoryClaimer[] {
  const claimers = [...fromLogs];
  if (
    claimedBy &&
    !claimers.some((c) => c.userId === claimedBy)
  ) {
    claimers.unshift({
      userId: claimedBy,
      displayName: claimedByName,
      claimedAt: claimedAt ?? new Date(0).toISOString(),
    });
  }
  claimers.sort(
    (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
  );
  return claimers;
}

export async function fetchMonitorStats(): Promise<MonitorStats | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const [statsRes, inventoryRes, claimLogsRes, errorsRes] = await Promise.all([
    admin.from('ai_monitor_stats').select('*').maybeSingle(),
    admin
      .from('case_inventory')
      .select(
        'id, case_id, difficulty, status, claimed_by, claimed_at, created_at, cases(title, play_count), profiles!case_inventory_claimed_by_fkey(display_name)'
      )
      .order('created_at', { ascending: false }),
    admin
      .from('activity_logs')
      .select('user_id, metadata, created_at, profiles(display_name)')
      .eq('action', 'case_from_inventory')
      .order('created_at', { ascending: false }),
    admin
      .from('ai_call_logs')
      .select('operation, model, error_message, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const claimersByCaseId = buildInventoryClaimersMap(claimLogsRes.data ?? []);

  const stats = statsRes.data;
  return {
    pendingJobs: stats?.pending_jobs ?? 0,
    recentPending: stats?.recent_pending ?? 0,
    aiCallsLastHour: stats?.ai_calls_last_hour ?? 0,
    avgLatencyMs: stats?.avg_latency_ms ?? 0,
    tokensLastHour: Number(stats?.tokens_last_hour ?? 0),
    inventory: (inventoryRes.data ?? []).map((r) => {
      const caseRow = unwrapJoinedRow(
        r.cases as { title: string; play_count: number } | { title: string; play_count: number }[] | null
      );
      const profile = unwrapJoinedRow(
        r.profiles as { display_name: string | null } | { display_name: string | null }[] | null
      );
      const claimers = mergeInventoryClaimers(
        claimersByCaseId.get(r.case_id) ?? [],
        r.claimed_by ?? null,
        profile?.display_name ?? null,
        r.claimed_at ?? null
      );
      return {
        id: r.id,
        caseId: r.case_id,
        title: caseRow?.title ?? r.case_id,
        difficulty: r.difficulty,
        status: r.status,
        claimers,
        createdAt: r.created_at,
        playCount: caseRow?.play_count ?? 0,
      };
    }),
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
