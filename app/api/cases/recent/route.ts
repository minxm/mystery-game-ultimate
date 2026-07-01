import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { fetchRecentUserCases } from '@/lib/supabase/database';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  try {
    const recent = await fetchRecentUserCases(userId, 5);
    return NextResponse.json({
      success: true,
      items: recent.map(({ caseData, progress }) => ({
        caseData,
        done: progress?.score !== undefined,
        score: progress?.score,
        progress,
      })),
    });
  } catch (error) {
    console.error('[Cases Recent]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
