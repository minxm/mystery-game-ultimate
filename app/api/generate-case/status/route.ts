import { NextRequest, NextResponse } from 'next/server';
import { getCaseJob } from '@/lib/case-job-store';

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ success: false, error: '缺少 jobId' }, { status: 400 });
  }

  try {
    const job = await getCaseJob(jobId);

    if (!job) {
      return NextResponse.json({ success: false, status: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: job.status,
      stage: job.stage || (job.status === 'done' ? 'done' : 'pending'),
      progressMessage: job.progressMessage,
      caseData: job.caseData,
      error: job.error,
    });
  } catch (error: any) {
    console.error('[API] Status check failed:', error.message);
    return NextResponse.json(
      { success: false, error: '无法读取任务状态' },
      { status: 500 }
    );
  }
}
