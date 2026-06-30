import { NextResponse } from 'next/server';
import { fetchLeaderboard } from '@/lib/supabase/database';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, entries: [] });
  }

  try {
    const entries = await fetchLeaderboard(50);
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error('[Leaderboard]', error);
    return NextResponse.json(
      { success: false, error: '获取排行榜失败' },
      { status: 500 }
    );
  }
}
