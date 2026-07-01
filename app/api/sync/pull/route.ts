import { NextResponse } from 'next/server';
import { createClientSafe } from '@/lib/supabase/server';
import {
  fetchUserCasesFromDb,
  fetchUserProgressListFromDb,
  fetchUserInterrogationsFromDb,
  loadUserStatsFromDb,
} from '@/lib/supabase/database';

export async function GET() {
  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ success: true, synced: false, data: null });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: true, synced: false, data: null });
  }

  try {
    const [cases, progress, interrogations, stats] = await Promise.all([
      fetchUserCasesFromDb(user.id),
      fetchUserProgressListFromDb(user.id),
      fetchUserInterrogationsFromDb(user.id),
      loadUserStatsFromDb(user.id),
    ]);

    return NextResponse.json({
      success: true,
      synced: true,
      data: { cases, progress, interrogations, stats },
    });
  } catch (error) {
    console.error('[Sync Pull]', error);
    return NextResponse.json({ success: false, error: '拉取失败' }, { status: 500 });
  }
}
