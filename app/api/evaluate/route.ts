import { NextRequest, NextResponse } from 'next/server';
import { evaluateDeduction } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { caseData, userDeduction } = await request.json();

    const evaluation = await evaluateDeduction(caseData, userDeduction);

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error('评分失败:', error);
    return NextResponse.json(
      { success: false, error: '评分失败，请重试' },
      { status: 500 }
    );
  }
}
