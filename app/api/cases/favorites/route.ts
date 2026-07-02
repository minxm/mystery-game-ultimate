import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { fetchUserFavoriteCases } from '@/lib/supabase/database';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  try {
    const items = await fetchUserFavoriteCases(userId, 50);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('[Cases Favorites]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
