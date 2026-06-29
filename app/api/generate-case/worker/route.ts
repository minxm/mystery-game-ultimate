import { NextRequest, NextResponse } from 'next/server';
import { executeCaseGenerationJob } from '@/lib/case-generation-job';

/** 本地/Vercel worker：无总超时，由前端轮询等待 */
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, difficulty } = body as { jobId?: string; difficulty?: string };

    if (!jobId || !difficulty) {
      return NextResponse.json(
        { success: false, error: '缺少 jobId 或 difficulty' },
        { status: 400 }
      );
    }

    console.log('[Worker] Case generation worker started:', jobId);
    await executeCaseGenerationJob(jobId, difficulty, { timeoutMs: 0 });

    return NextResponse.json({ success: true, jobId });
  } catch (error: unknown) {
    console.error('[Worker] Unexpected error:', (error as Error)?.message);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'worker 失败' },
      { status: 500 }
    );
  }
}
