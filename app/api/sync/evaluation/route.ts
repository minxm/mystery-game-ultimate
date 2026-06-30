import { NextRequest, NextResponse } from 'next/server';
import { createClientSafe } from '@/lib/supabase/server';
import { saveEvaluationToDb, logActivity } from '@/lib/supabase/database';

export async function POST(request: NextRequest) {
  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ success: true, synced: false });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: true, synced: false });
  }

  try {
    const { caseId, evaluation, userDeduction } = await request.json();
    await saveEvaluationToDb(user.id, caseId, {
      score: evaluation.score,
      breakdown: evaluation.breakdown,
      feedback: evaluation.feedback,
      rating: evaluation.rating,
      killerCorrect: evaluation.killerCorrect,
      missedClues: evaluation.missedClues ?? [],
      userDeduction,
    });
    await logActivity(user.id, 'evaluation_submitted', {
      caseId,
      score: evaluation.score,
    });
    return NextResponse.json({ success: true, synced: true });
  } catch (error) {
    console.error('[Sync Evaluation]', error);
    return NextResponse.json({ success: false, error: '同步失败' }, { status: 500 });
  }
}
