import { NextRequest, NextResponse } from 'next/server';
import { shareCaseToInventory } from '@/lib/case-inventory';
import { getSessionUserId } from '@/lib/supabase/server';
import type { CaseData } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase 未配置' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const caseData = body.caseData as CaseData | undefined;
    if (!caseData?.id) {
      return NextResponse.json({ success: false, error: '无效案件数据' }, { status: 400 });
    }

    const userId = await getSessionUserId().catch(() => null);
    const shared = await shareCaseToInventory(caseData, caseData.difficulty, userId);
    if (!shared) {
      return NextResponse.json(
        {
          success: false,
          error:
            '入库失败：数据库缺少 cases 表权限。请在 Supabase SQL Editor 执行 supabase/migrations/20250701000001_table_grants.sql，并确认 .env.local 中 SUPABASE_SERVICE_ROLE_KEY 为 service_role 密钥（非 anon key）。',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, caseId: caseData.id });
  } catch (error) {
    console.error('[Cases Save]', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}
