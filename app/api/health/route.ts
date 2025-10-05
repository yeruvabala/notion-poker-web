import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    time: new Date().toISOString(),
  });
}
