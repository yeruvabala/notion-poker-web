// app/api/analyze-hand/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();

    // 1) Try cookie-based auth (SSR)
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // 2) If no cookie session, try Bearer token from the client
    if (!user) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;

      if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (error) {
          // swallow and continue to 401
        } else {
          user = data.user ?? null;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- parse body ---
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      board,
      notes,
      rawText,
      fe_hint,
      spr_hint,
      action_hint,
      hand_class,
      source_used,
    } = body ?? {};

    // --- call your model / OpenAI as before ---
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: openaiKey });

    // Simple prompt (keep your original logic if you had more):
    const prompt = `
You are a poker coach. Analyze this hand and return:
- GTO_STRATEGY: ... (concise)
- EXPLOIT_DEVIATION: ... (concise)
- LEARNING_TAGS: comma list

Meta:
date=${date ?? ''}
stakes=${stakes ?? ''}
position=${position ?? ''}
cards=${cards ?? ''}
board=${board ?? ''}
fe=${fe_hint ?? ''}
spr=${spr_hint ?? ''}
action_hint=${action_hint ?? ''}
hand_class=${hand_class ?? ''}
source_used=${source_used ?? ''}

Story:
${rawText || notes || ''}
`.trim();

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const text = resp.choices?.[0]?.message?.content ?? '';
    // naive parsing; keep whatever you had before
    const gto_strategy = text;
    const exploit_deviation = '';
    const learning_tag = [];

    return NextResponse.json({
      ok: true,
      gto_strategy,
      exploit_deviation,
      learning_tag,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Analyze failed' },
      { status: 500 }
    );
  }
}
