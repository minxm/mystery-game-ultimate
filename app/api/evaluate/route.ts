import { NextRequest, NextResponse } from 'next/server';
import { evaluateDeduction } from '@/lib/ai';
import { setAiRequestContext, clearAiRequestContext } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const { caseData, userDeduction } = await request.json();

    setAiRequestContext({ caseId: caseData?.id });
    const evaluation = await evaluateDeduction(caseData, userDeduction);
    clearAiRequestContext();

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    clearAiRequestContext();
    console.error('评分失败:', error);
    return NextResponse.json(
      { success: false, error: '评分失败，请重试' },
      { status: 500 }
    );
  }
}
