import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    hasApiKey: !!process.env.OPENAI_API_KEY,
    apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'none',
    nodeEnv: process.env.NODE_ENV,
  });
}
