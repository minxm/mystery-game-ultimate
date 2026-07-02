import type { MonitorStats } from '@/lib/supabase/database';

export type MonitorStatsPayload = MonitorStats;

export const EMPTY_MONITOR_STATS: MonitorStatsPayload = {
  pendingJobs: 0,
  recentPending: 0,
  aiCallsLastHour: 0,
  avgLatencyMs: 0,
  tokensLastHour: 0,
  inventory: [],
  recentErrors: [],
};

export function normalizeMonitorStats(
  stats: Partial<MonitorStatsPayload> | null | undefined
): MonitorStatsPayload {
  return {
    pendingJobs: stats?.pendingJobs ?? 0,
    recentPending: stats?.recentPending ?? 0,
    aiCallsLastHour: stats?.aiCallsLastHour ?? 0,
    avgLatencyMs: stats?.avgLatencyMs ?? 0,
    tokensLastHour: stats?.tokensLastHour ?? 0,
    inventory: stats?.inventory ?? [],
    recentErrors: stats?.recentErrors ?? [],
  };
}
