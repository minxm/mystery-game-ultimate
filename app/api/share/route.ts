import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import {
  createShareToken,
  loadCaseByShareToken,
  loadCaseFromDb,
  saveCaseToDb,
} from '@/lib/supabase/database';
import type { CaseData } from '@/lib/types';

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  const body = await request.json();
  const caseId = body.caseId as string | undefined;
  const caseData = body.caseData as CaseData | undefined;
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  let exists = await loadCaseFromDb(caseId);
  if (!exists && caseData?.id === caseId) {
    const saved = await saveCaseToDb(caseData, userId, { isPublic: true });
    if (saved) exists = caseData;
  }
  if (!exists) {
    return NextResponse.json(
      { success: false, error: '案件尚未同步到云端，请稍后重试' },
      { status: 404 }
    );
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
