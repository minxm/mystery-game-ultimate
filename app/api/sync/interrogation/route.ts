import { NextRequest, NextResponse } from 'next/server';
import { createClientSafe } from '@/lib/supabase/server';
import { saveInterrogationToDb } from '@/lib/supabase/database';
import { InterrogationMessage } from '@/lib/types';

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
    const { caseId, suspectId, messages } = await request.json() as {
      caseId: string;
      suspectId: string;
      messages: InterrogationMessage[];
    };
    await saveInterrogationToDb(user.id, caseId, suspectId, messages);
    return NextResponse.json({ success: true, synced: true });
  } catch (error) {
    console.error('[Sync Interrogation]', error);
    return NextResponse.json({ success: false, error: '同步失败' }, { status: 500 });
  }
}
