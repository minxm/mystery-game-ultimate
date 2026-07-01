import MonitorDashboard from '@/components/MonitorDashboard';
import { fetchMonitorStats } from '@/lib/supabase/database';
import { requireMonitorAccess } from '@/lib/server-admin-auth';

const EMPTY_STATS = {
  pendingJobs: 0,
  recentPending: 0,
  aiCallsLastHour: 0,
  avgLatencyMs: 0,
  tokensLastHour: 0,
  inventory: [] as { difficulty: string; available: number; claimed: number }[],
  recentErrors: [] as {
    operation: string;
    model: string;
    errorMessage: string;
    createdAt: string;
  }[],
};

export default async function MonitorPage() {
  const access = await requireMonitorAccess();

  if (!access.allowed) {
    return <MonitorDashboard initialStats={EMPTY_STATS} accessDenied />;
  }

  const stats = (await fetchMonitorStats()) ?? EMPTY_STATS;
  return <MonitorDashboard initialStats={stats} />;
}
