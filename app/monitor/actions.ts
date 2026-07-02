'use server';

import { fetchMonitorStats } from '@/lib/supabase/database';
import { backfillInventoryClaims } from '@/lib/case-inventory';
import { requireMonitorAccess } from '@/lib/server-admin-auth';
import { EMPTY_MONITOR_STATS, normalizeMonitorStats } from './types';

export async function refreshMonitorStats(accessToken?: string | null): Promise<{
  success: boolean;
  stats?: ReturnType<typeof normalizeMonitorStats>;
  error?: string;
}> {
  const access = await requireMonitorAccess(accessToken);
  if (!access.allowed) {
    return { success: false, error: '无权访问监控数据' };
  }

  try {
    await backfillInventoryClaims();
    const stats = normalizeMonitorStats((await fetchMonitorStats()) ?? EMPTY_MONITOR_STATS);
    return { success: true, stats };
  } catch (error) {
    console.error('[Monitor] refreshMonitorStats failed:', error);
    return { success: false, error: '加载监控数据失败' };
  }
}
