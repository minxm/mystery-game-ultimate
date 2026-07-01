import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { fetchUserHistory } from '@/lib/supabase/database';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  const history = await fetchUserHistory(userId);
  return NextResponse.json({ success: true, history });
}
