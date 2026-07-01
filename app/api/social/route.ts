import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/supabase/server';
import {
  fetchCaseComments,
  addCaseComment,
  toggleCaseFavorite,
  isCaseFavorited,
  reportCase,
} from '@/lib/supabase/database';

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get('caseId');
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  const userId = await getSessionUserId().catch(() => null);
  const [comments, favorited] = await Promise.all([
    fetchCaseComments(caseId),
    userId ? isCaseFavorited(caseId, userId) : Promise.resolve(false),
  ]);

  return NextResponse.json({ success: true, comments, favorited });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  }

  const body = await request.json();
  const { action, caseId, content, reason, detail } = body;

  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  switch (action) {
    case 'comment': {
      if (!content?.trim()) {
        return NextResponse.json({ success: false, error: '评论不能为空' }, { status: 400 });
      }
      const ok = await addCaseComment(caseId, userId, content);
      return NextResponse.json({ success: ok });
    }
    case 'favorite': {
      const result = await toggleCaseFavorite(caseId, userId);
      return NextResponse.json({ success: true, ...result });
    }
    case 'report': {
      if (!reason?.trim()) {
        return NextResponse.json({ success: false, error: '请填写举报原因' }, { status: 400 });
      }
      const ok = await reportCase(caseId, userId, reason, detail);
      return NextResponse.json({ success: ok });
    }
    default:
      return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  }
}
