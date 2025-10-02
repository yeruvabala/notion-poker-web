// app/api/analyze-hand/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing Supabase env vars' },
        { status: 500 }
      );
    }

    // Accept access token from Authorization header *or* from cookies
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : undefined;

    const { data: userData, error: userErr } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      'You are a poker coach. Summarize strategy and exploits for this hand.',
      'Return short, clear bullets. If details are missing, be generic.',
      '',
      'INPUT JSON:',
      JSON.stringify(body, null, 2),
    ].join('\n');

    // Use chat.completions for broad SDK compatibility
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4o' / another model you have access to
      messages: [
        { role: 'system', content: 'You are a concise poker coach.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() || 'No output generated';

    return NextResponse.json({
      ok: true,
      gto_strategy: text,
      exploit_deviation: '',
      learning_tag: [] as string[],
    });
  } catch (err: any) {
    console.error('analyze-hand error:', err);
    return NextResponse.json(
      { error: err?.message || 'Analyze failed' },
      { status: 500 }
    );
  }
}
