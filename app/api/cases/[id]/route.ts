import { NextResponse } from 'next/server';
import { loadCaseFromDb, incrementCasePlayCount } from '@/lib/supabase/database';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase 未配置' }, { status: 503 });
  }

  const caseId = params.id;
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少案件 ID' }, { status: 400 });
  }

  try {
    const caseData = await loadCaseFromDb(caseId);
    if (!caseData) {
      return NextResponse.json({ success: false, error: '案件不存在' }, { status: 404 });
    }

    void incrementCasePlayCount(caseId);
    return NextResponse.json({ success: true, caseData });
  } catch (error) {
    console.error('[Cases Get]', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
