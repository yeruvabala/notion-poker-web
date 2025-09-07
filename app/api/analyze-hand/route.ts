// app/api/analyze-hand/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      date,
      stakes,
      position,
      cards,
      villainAction,
      board = '',
      notes = '',
    } = body || {};

    // Build a compact user block for the model
    const userBlock = [
      date ? `Date: ${date}` : '',
      stakes ? `Stakes: ${stakes}` : '',
      position ? `Position: ${position}` : '',
      cards ? `Hero Cards: ${cards}` : '',
      board ? `Board/Street Info: ${board}` : '',
      villainAction ? `Villain Action: ${villainAction}` : '',
      notes ? `Notes: ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const system = `
You are a poker strategy assistant. Return ONLY JSON.

Keys:
- gto_strategy (string): 4 short lines, each for Preflop / Flop / Turn / River with ACTIONS and SIZES (e.g., "3-bet 10–11bb", "bet 25–33%", "check–call 50%", etc). Be specific and actionable.
- exploit_deviation (string): 2–4 concise sentences on how to exploit population tendencies in this spot (no hand reveals).
- learning_tag (array of 1–3 short strings): tags like "SB vs CO 3-bet pot", "Small-bet low boards", "Overfold big river", "Cooler", "Flip", "Bad beat", etc.

Style constraints:
- Focus on what to do and sizes, not narration.
- <= 120 words for gto_strategy; <= 60 words for exploit_deviation.
- Return a single JSON object only. No markdown, no extra text.
`.trim();

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or your preferred model
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            userBlock ||
            'No details provided. Output generic JSON per instructions.',
        },
      ],
      response_format: { type: 'json_object' },
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || '{}';

    let out: {
      gto_strategy?: string;
      exploit_deviation?: string;
      learning_tag?: string[] | string;
    } = {};
    try {
      out = JSON.parse(text);
    } catch {
      // If model returned plain text, stuff it into gto_strategy as a fallback.
      out = { gto_strategy: text };
    }

    // Normalize tags to array<string>
    const learning_tag =
      Array.isArray(out.learning_tag)
        ? out.learning_tag
        : typeof out.learning_tag === 'string'
          ? out.learning_tag
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

    return NextResponse.json({
      gto_strategy: out.gto_strategy || '',
      exploit_deviation: out.exploit_deviation || '',
      learning_tag,
    });
  } catch (err) {
    console.error('analyze-hand error:', err);
    return NextResponse.json(
      { error: 'Failed to analyze hand' },
      { status: 500 }
    );
  }
}
