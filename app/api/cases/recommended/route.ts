import { NextResponse } from 'next/server';
import {
  fetchRecommendedCases,
  fetchUserProgressForCaseIds,
  fetchUserEvaluationsForCaseIds,
} from '@/lib/supabase/database';
import { getSessionUserId } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, items: [] });
  }

  try {
    const userIdPromise = withTimeout(getSessionUserId().catch(() => null), 2000, null);
    const cases = await fetchRecommendedCases(5);
    const userId = await userIdPromise;

    const progressMap = new Map<
      string,
      Awaited<ReturnType<typeof fetchUserProgressForCaseIds>>[number]
    >();
    const evalMap = new Map<string, { score: number }>();

    if (userId && cases.length > 0) {
      const caseIds = cases.map((c) => c.id);
      const [progressList, evalList] = await Promise.all([
        withTimeout(fetchUserProgressForCaseIds(userId, caseIds), 2000, []),
        withTimeout(fetchUserEvaluationsForCaseIds(userId, caseIds), 2000, []),
      ]);
      for (const progress of progressList) {
        progressMap.set(progress.caseId, progress);
      }
      for (const ev of evalList) {
        if (!evalMap.has(ev.caseId)) evalMap.set(ev.caseId, { score: ev.score });
      }
    }

    return NextResponse.json(
      {
        success: true,
        items: cases.map((caseData) => {
          const progress = progressMap.get(caseData.id) ?? null;
          const evaluation = evalMap.get(caseData.id);
          const done =
            evaluation != null ||
            progress?.score !== undefined ||
            progress?.endTime !== undefined;
          return {
            caseData,
            done,
            score: evaluation?.score ?? progress?.score,
            progress,
            evaluation: evaluation
              ? {
                  score: evaluation.score,
                  breakdown: {},
                  feedback: '',
                  rating: '',
                  missedClues: [],
                }
              : null,
          };
        }),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[Cases Recommended]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
