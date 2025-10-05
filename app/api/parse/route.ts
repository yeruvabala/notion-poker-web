// app/api/parse/route.ts
import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

// Simple fallback parser if OPENAI_API_KEY is missing
function cheapParse(text: string) {
  const out: any = { learning_tag: [] as string[] };

  // Stakes like 1/2 or $1/$2
  const stakes = text.match(/\$?\d+(\.\d+)?\s*\/\s*\$?\d+(\.\d+)?/i);
  if (stakes) out.stakes = stakes[0];

  // Hero cards (very naive)
  const hero = text.match(/\b([AKQJT2-9]{1,2}\s*[♠♥♦♣shdc]?)\s+([AKQJT2-9]{1,2}\s*[♠♥♦♣shdc]?)\b/);
  if (hero) out.cards = hero[0];

  if (/button|btn/i.test(text) && /bb|big blind/i.test(text)) out.position = 'BTN vs BB';
  else if (/utg/i.test(text)) out.position = 'UTG';
  else if (/mp/i.test(text)) out.position = 'MP';

  const flop = text.match(/\b([AKQJT2-9]{1,2}[♠♥♦♣shdc]?\s+){3}/i);
  const turn = text.match(/\bturn\s+([AKQJT2-9]{1,2}[♠♥♦♣shdc]?)\b/i);
  const river = text.match(/\briver\s+([AKQJT2-9]{1,2}[♠♥♦♣shdc]?)\b/i);
  if (flop) {
    const f = flop[0].trim();
    const t = turn?.[1] ? ` / ${turn[1]}` : '';
    const r = river?.[1] ? ` / ${river[1]}` : '';
    out.board = `${f}${t}${r}`.replace(/\s+/g, ' ');
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const input =
      typeof body === 'string'
        ? body
        : typeof body?.input === 'string'
        ? body.input
        : '';

    if (!input.trim()) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    // Fallback if no key configured
    if (!process.env.OPENAI_API_KEY) {
      const approx = cheapParse(input);
      return NextResponse.json(approx);
    }

    const SYSTEM = `You are a poker study parser. Extract concise fields from the user's free text.
Return STRICT JSON with keys:
{
  "date": "YYYY-MM-DD" | null,
  "stakes": string | null,
  "position": string | null,
  "cards": string | null,
  "board": string | null,
  "learning_tag": string[]
}`;

    const user = `Text: ${new Date().toISOString().slice(0, 10)}
Rules: If date missing, you may set today's date. Stakes is a free-form string (e.g., "$2/$5" or "2/5").` + '\n\n' + input;

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(raw);
    parsed.learning_tag = Array.isArray(parsed.learning_tag) ? parsed.learning_tag : [];
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Parse failed' }, { status: 500 });
  }
}
