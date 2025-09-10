// app/api/judge/route.ts
import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

const SYSTEM = `You are a strict poker judge. Your job is to identify actual mistakes the hero made on each street and suggest the better line.

Return ONLY JSON with EXACT keys:
{
  "mistakes": [
    { "street": "preflop|flop|turn|river", "hero_action": "string", "why_wrong": "string", "better_line": "string" }
  ],
  "short_summary": "string"
}

Rules:
- Use the provided mode (cash or mtt). If mtt with icm_context=true, apply ICM risk-premium (tighten calls, prefer jam/fold at 12–20bb, fold more vs early strength, avoid punting on bubbles).
- Only mark a mistake if the hero's described action is clearly inferior to a standard/GTO or strong exploit line given stacks/positions/board.
- Do NOT praise or rationalize a bad play; prefer clarity.
- If the play is fine, return mistakes = [] and a short_summary like "Line is fine."`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text = '', mode = '', icm_context = false, eff_bb = null, blinds = '', board = '' } = body ?? {};

    const userBlock = [
      `Mode: ${mode || 'unknown'}`,
      `ICM: ${icm_context ? 'true' : 'false'}`,
      `Eff bb: ${eff_bb ?? 'unknown'}`,
      `Blinds: ${blinds || 'unknown'}`,
      `Board: ${board || 'unknown'}`,
      `Transcript:`,
      text,
    ].join('\n');

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userBlock },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { mistakes: [], short_summary: '' }; }

    const out = {
      mistakes: Array.isArray(parsed?.mistakes) ? parsed.mistakes.filter((m: any) =>
        m && typeof m.street === 'string' && typeof m.hero_action === 'string') : [],
      short_summary: typeof parsed?.short_summary === 'string' ? parsed.short_summary : '',
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || 'Judge error';
    console.error('judge error:', msg);
    return NextResponse.json({ mistakes: [], short_summary: '' }, { status: 500 });
  }
}
