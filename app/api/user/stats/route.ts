import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { loadUserStatsFromDb } from '@/lib/supabase/database';
import type { UserStats } from '@/lib/types';

const EMPTY_STATS: UserStats = {
  casesCompleted: 0,
  averageScore: 0,
  perfectSolves: 0,
  streak: 0,
  achievements: [],
};

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  try {
    const stats = await loadUserStatsFromDb(userId);
    return NextResponse.json({
      success: true,
      stats: stats ?? EMPTY_STATS,
    });
  } catch (error) {
    console.error('[User Stats]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
