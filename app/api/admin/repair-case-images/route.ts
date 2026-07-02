import { NextRequest, NextResponse } from 'next/server';
import { loadCaseFromDb, saveCaseToDb } from '@/lib/supabase/database';
import { uploadCaseImages } from '@/lib/supabase/storage';
import { repairCaseMissingImages } from '@/lib/case-image-repair';
import { listMissingCharacterImageIds } from '@/lib/case-image-utils';
import { authorizeCronBearer } from '@/lib/server-admin-auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const maxDuration = 300;

/** 补全案件中缺失的 AI 人物图（Cron/运维：Bearer INVENTORY_REFILL_SECRET） */
export async function POST(request: NextRequest) {
  const authError = authorizeCronBearer(request, 'INVENTORY_REFILL_SECRET');
  if (authError) return authError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase 未配置' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : '';
  if (!caseId) {
    return NextResponse.json({ success: false, error: '缺少 caseId' }, { status: 400 });
  }

  try {
    const existing = await loadCaseFromDb(caseId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '案件不存在' }, { status: 404 });
    }

    const missingBefore = listMissingCharacterImageIds(existing);
    const { caseData: repaired, repaired: repairedIds } = await repairCaseMissingImages(existing);
    const uploaded = await uploadCaseImages(repaired);
    const saved = await saveCaseToDb(uploaded, null, { isPublic: true });
    if (!saved) {
      return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
    }

    const missingAfter = listMissingCharacterImageIds(uploaded);
    return NextResponse.json({
      success: true,
      caseId,
      missingBefore,
      repaired: repairedIds,
      missingAfter,
    });
  } catch (error) {
    console.error('[RepairCaseImages]', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || '补图失败' },
      { status: 500 }
    );
  }
}
