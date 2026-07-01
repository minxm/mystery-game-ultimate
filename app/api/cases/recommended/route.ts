import { NextResponse } from 'next/server';
import { fetchRecommendedCases, fetchUserProgressListFromDb } from '@/lib/supabase/database';
import { getSessionUserId } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, items: [] });
  }

  try {
    const [cases, userId] = await Promise.all([
      fetchRecommendedCases(5),
      getSessionUserId().catch(() => null),
    ]);

    const progressMap = new Map<string, Awaited<ReturnType<typeof fetchUserProgressListFromDb>>[number]>();
    if (userId && cases.length > 0) {
      const caseIds = new Set(cases.map((c) => c.id));
      const progressList = await fetchUserProgressListFromDb(userId);
      for (const p of progressList) {
        if (caseIds.has(p.caseId)) progressMap.set(p.caseId, p);
      }
    }

    return NextResponse.json({
      success: true,
      items: cases.map((caseData) => {
        const progress = progressMap.get(caseData.id) ?? null;
        return {
          caseData,
          done: progress?.score !== undefined,
          score: progress?.score,
          progress,
        };
      }),
    });
  } catch (error) {
    console.error('[Cases Recommended]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
