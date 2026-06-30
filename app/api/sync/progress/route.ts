import { NextRequest, NextResponse } from 'next/server';
import { createClientSafe } from '@/lib/supabase/server';
import { saveProgressToDb, logActivity } from '@/lib/supabase/database';
import { GameProgress } from '@/lib/types';

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
    const progress = (await request.json()) as GameProgress;
    await saveProgressToDb(user.id, progress);
    await logActivity(user.id, 'progress_saved', { caseId: progress.caseId });
    return NextResponse.json({ success: true, synced: true });
  } catch (error) {
    console.error('[Sync Progress]', error);
    return NextResponse.json({ success: false, error: '同步失败' }, { status: 500 });
  }
}
