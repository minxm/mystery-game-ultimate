import { NextRequest, NextResponse } from 'next/server';
import { addCaseToInventory, needsRefill, MIN_INVENTORY } from '@/lib/case-inventory';
import { buildCaseFromPhases } from '@/lib/generate-case-orchestrator';
import { uploadCaseImages } from '@/lib/supabase/storage';
import { setAiRequestContext, clearAiRequestContext } from '@/lib/ai-service';
import { authorizeCronBearer } from '@/lib/server-admin-auth';
import { repairCaseMissingImages } from '@/lib/case-image-repair';

export const maxDuration = 600;

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;

/** 后台补货（Cron 专用）：Authorization: Bearer <INVENTORY_REFILL_SECRET> */
export async function POST(request: NextRequest) {
  const authError = authorizeCronBearer(request, 'INVENTORY_REFILL_SECRET');
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const targetDifficulty = body.difficulty as string | undefined;
  const maxPerRun = Math.min(Number(body.maxPerRun) || 2, 5);

  const toRefill: string[] = [];
  if (targetDifficulty) {
    if (await needsRefill(targetDifficulty)) toRefill.push(targetDifficulty);
  } else {
    for (const d of DIFFICULTIES) {
      if (await needsRefill(d)) toRefill.push(d);
    }
  }

  if (toRefill.length === 0) {
    return NextResponse.json({ success: true, message: '库存充足，无需补货', refilled: [] });
  }

  const refilled: { difficulty: string; caseId: string; title: string }[] = [];

  setAiRequestContext({ metadata: { source: 'inventory_refill' } });

  try {
    for (const difficulty of toRefill) {
      for (let i = 0; i < maxPerRun; i++) {
        if (!(await needsRefill(difficulty))) break;

        try {
          // 补货为后台批处理，无需写入 case_generation_jobs
          let caseData = await buildCaseFromPhases(difficulty);
          caseData = await uploadCaseImages(caseData);
          const { caseData: repaired, repaired: repairedIds } =
            await repairCaseMissingImages(caseData);
          if (repairedIds.length) {
            console.log('[Inventory] Repaired missing images:', repairedIds.join(', '));
            caseData = await uploadCaseImages(repaired);
          }
          await addCaseToInventory(caseData, difficulty);
          refilled.push({
            difficulty,
            caseId: caseData.id,
            title: caseData.title,
          });
        } catch (err) {
          console.warn('[Inventory] Refill failed for', difficulty, (err as Error)?.message);
          break;
        }
      }
    }
  } finally {
    clearAiRequestContext();
  }

  return NextResponse.json({
    success: true,
    refilled,
    thresholds: MIN_INVENTORY,
  });
}

/** 库存概览（Cron 专用，与 POST 相同鉴权） */
export async function GET(request: NextRequest) {
  const authError = authorizeCronBearer(request, 'INVENTORY_REFILL_SECRET');
  if (authError) return authError;

  const { getInventoryStats } = await import('@/lib/case-inventory');
  const stats = await getInventoryStats();
  return NextResponse.json({ success: true, stats, thresholds: MIN_INVENTORY });
}
