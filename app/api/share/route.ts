import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import { createShareToken, loadCaseByShareToken } from '@/lib/supabase/database';

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  const { caseId } = await request.json();
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  const token = await createShareToken(caseId, userId);
  if (!token) {
    return NextResponse.json({ success: false, error: '分享失败' }, { status: 500 });
  }

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    success: true,
    token,
    shareUrl: `${origin}/share/${token}`,
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ success: false, error: '缺少 token' }, { status: 400 });
  }

  const caseData = await loadCaseByShareToken(token);
  if (!caseData) {
    return NextResponse.json({ success: false, error: '案件不存在或未公开' }, { status: 404 });
  }

  return NextResponse.json({ success: true, caseData, token });
}
