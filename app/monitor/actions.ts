'use server';

import { fetchMonitorStats } from '@/lib/supabase/database';
import { requireMonitorAccess } from '@/lib/server-admin-auth';

export type MonitorStatsPayload = NonNullable<Awaited<ReturnType<typeof fetchMonitorStats>>>;

const EMPTY_STATS: MonitorStatsPayload = {
  pendingJobs: 0,
  recentPending: 0,
  aiCallsLastHour: 0,
  avgLatencyMs: 0,
  tokensLastHour: 0,
  inventory: [],
  recentErrors: [],
};

export async function refreshMonitorStats(): Promise<{
  success: boolean;
  stats?: MonitorStatsPayload;
  error?: string;
}> {
  const access = await requireMonitorAccess();
  if (!access.allowed) {
    return { success: false, error: '无权访问监控数据' };
  }

  const stats = (await fetchMonitorStats()) ?? EMPTY_STATS;
  return { success: true, stats };
}
