import { NextRequest, NextResponse } from 'next/server';
import { createClientSafe } from '@/lib/supabase/server';
import { loadCaseForUser } from '@/lib/supabase/database';

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get('caseId');
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ success: true, case: null });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: true, case: null });
  }

  try {
    const caseData = await loadCaseForUser(caseId, user.id);
    return NextResponse.json({ success: true, case: caseData });
  } catch (error) {
    console.error('[Sync Case]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
