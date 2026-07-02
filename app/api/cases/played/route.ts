import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { fetchUserPlayedCases } from '@/lib/supabase/database';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  try {
    const items = await fetchUserPlayedCases(userId, 5);
    return NextResponse.json({
      success: true,
      items: items.map(({ caseData, progress, evaluation }) => ({
        caseData,
        done:
          evaluation != null ||
          progress.score !== undefined ||
          progress.endTime !== undefined,
        score: evaluation?.score ?? progress.score,
        progress,
        evaluation,
      })),
    });
  } catch (error) {
    console.error('[Cases Played]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
