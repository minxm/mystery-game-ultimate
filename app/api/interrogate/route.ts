import { NextRequest, NextResponse } from 'next/server';
import { chatWithSuspect } from '@/lib/ai';
import { INTERROGATION_SYSTEM_PROMPT } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { suspect, messages, evidence, caseContext } = await request.json();

    const systemPrompt = INTERROGATION_SYSTEM_PROMPT(suspect, evidence, caseContext);

    const response = await chatWithSuspect(messages, systemPrompt);

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error('审问失败:', error);
    return NextResponse.json(
      { success: false, error: '审问失败，请重试' },
      { status: 500 }
    );
  }
}
