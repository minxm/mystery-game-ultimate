import { createAdminClientSafe } from '@/lib/supabase/admin';
import { CaseData } from '@/lib/types';
import { incrementCasePlayCount, logActivity, saveCaseToDb } from '@/lib/supabase/database';

const MIN_INVENTORY: Record<string, number> = {
  easy: 2,
  medium: 3,
  hard: 2,
  expert: 1,
};

export interface InventoryStats {
  easy: number;
  medium: number;
  hard: number;
  expert: number;
}

/**
 * 从库存分配一个预生成案件（每位用户独占一条库存记录）。
 * 领取后标记 status=claimed，并记录 claimed_by / claimed_at。
 */
export async function claimCaseFromInventory(
  difficulty: string,
  userId?: string | null
): Promise<CaseData | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: rows, error } = await admin
      .from('case_inventory')
      .select('id, case_id, cases!inner(case_data)')
      .eq('difficulty', difficulty)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !rows?.length) return null;

    const row = rows[0] as {
      id: string;
      case_id: string;
      cases: { case_data: CaseData } | { case_data: CaseData }[] | null;
    };

    const caseRow = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    if (!caseRow?.case_data) return null;

    const claimedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from('case_inventory')
      .update({
        status: 'claimed',
        claimed_by: userId ?? null,
        claimed_at: claimedAt,
      })
      .eq('id', row.id)
      .eq('status', 'available')
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.warn('[Inventory] claim update failed:', updateError.message);
      return null;
    }
    if (!updated) continue;

    const caseData = {
      ...caseRow.case_data,
      id: row.case_id,
    } as CaseData;

    void incrementCasePlayCount(row.case_id);
    await logActivity(userId ?? null, 'case_from_inventory', {
      caseId: row.case_id,
      difficulty,
    });

    return caseData;
  }

  return null;
}

/** 将仍为 available 但已有领取日志的库存记录回填为 claimed（兼容历史数据） */
export async function backfillInventoryClaims(): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;

  const { data: logs, error } = await admin
    .from('activity_logs')
    .select('user_id, metadata, created_at')
    .eq('action', 'case_from_inventory')
    .order('created_at', { ascending: false });

  if (error || !logs?.length) return;

  const latestClaimByCaseId = new Map<string, { userId: string | null; claimedAt: string }>();
  for (const log of logs) {
    const caseId = (log.metadata as { caseId?: string } | null)?.caseId;
    if (!caseId || latestClaimByCaseId.has(caseId)) continue;
    latestClaimByCaseId.set(caseId, {
      userId: log.user_id ?? null,
      claimedAt: log.created_at,
    });
  }

  await Promise.all(
    [...latestClaimByCaseId.entries()].map(([caseId, claim]) =>
      admin
        .from('case_inventory')
        .update({
          status: 'claimed',
          claimed_by: claim.userId,
          claimed_at: claim.claimedAt,
        })
        .eq('case_id', caseId)
        .eq('status', 'available')
    )
  );
}

/** 查询指定难度是否有可用库存（仅读，不领取） */
export async function hasInventoryForDifficulty(difficulty: string): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  const { count, error } = await admin
    .from('case_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('difficulty', difficulty)
    .eq('status', 'available');

  return !error && (count ?? 0) > 0;
}

/** 将案件写入预存库（幂等：已在库中则跳过） */
export async function shareCaseToInventory(
  caseData: CaseData,
  difficulty: string,
  userId?: string | null
): Promise<boolean> {
  const admin = createAdminClientSafe();
  if (!admin) return false;

  const saved = await saveCaseToDb(caseData, userId ?? null, { isPublic: true });
  if (!saved) return false;

  const { data: existing } = await admin
    .from('case_inventory')
    .select('id')
    .eq('case_id', caseData.id)
    .maybeSingle();

  if (existing) return true;

  const { error } = await admin.from('case_inventory').insert({
    difficulty,
    case_id: caseData.id,
    status: 'available',
  });

  if (error) {
    console.warn('[Inventory] shareCaseToInventory failed:', error.message, caseData.id);
    return false;
  }
  return true;
}

/** 将已生成案件写入库存（系统补货，user_id=null） */
export async function addCaseToInventory(
  caseData: CaseData,
  difficulty: string
): Promise<void> {
  await shareCaseToInventory(caseData, difficulty, null);
}

/** 获取各难度可用库存数量 */
export async function getInventoryStats(): Promise<InventoryStats> {
  const admin = createAdminClientSafe();
  const empty: InventoryStats = { easy: 0, medium: 0, hard: 0, expert: 0 };
  if (!admin) return empty;

  const { data } = await admin.from('case_inventory_stats').select('*');
  if (!data) return empty;

  const stats = { ...empty };
  for (const row of data) {
    const d = row.difficulty as keyof InventoryStats;
    if (d in stats) stats[d] = row.available ?? 0;
  }
  return stats;
}

/** 检查是否需要补货 */
export async function needsRefill(difficulty: string): Promise<boolean> {
  const stats = await getInventoryStats();
  const key = difficulty as keyof InventoryStats;
  return (stats[key] ?? 0) < (MIN_INVENTORY[difficulty] ?? 2);
}

export { MIN_INVENTORY };
