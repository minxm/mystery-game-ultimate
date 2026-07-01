import { NextResponse } from 'next/server';
import { fetchCaseArchive } from '@/lib/supabase/database';
import { getSessionUserId } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  try {
    const archive = await fetchCaseArchive(userId, params.id);
    if (!archive) {
      return NextResponse.json({ success: false, error: '档案不存在或案件未完成' }, { status: 404 });
    }
    return NextResponse.json({ success: true, archive });
  } catch (error) {
    console.error('[Cases Archive]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
