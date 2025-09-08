// app/api/analyze-hand/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Helpers to normalize cards & extract facts from raw text ----------
const rankMap: Record<string, string> = {
  a: 'A',
  k: 'K',
  q: 'Q',
  j: 'J',
  t: 'T',
  '10': 'T',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};
const suitUnicode = { d: '♦', c: '♣', h: '♥', s: '♠' } as const;
const unicodeToLetter: Record<string, 'd' | 'c' | 'h' | 's'> = {
  '♦': 'd',
  '♣': 'c',
  '♥': 'h',
  '♠': 's',
};
function normalizeOneCard(token: string): string | null {
  if (!token) return null;

  // Examples: '4d', '8s', '2c', 'Ad', 'A♦', '9♥'
  let raw = token.trim().toLowerCase();

  // handle unicode suit
  const uniSuit = raw[raw.length - 1];
  if (unicodeToLetter[uniSuit]) {
    const r = raw.slice(0, raw.length - 1);
    const R =
      rankMap[r] ||
      rankMap[r.replace(/[^a-z0-9]/g, '')] ||
      r.toUpperCase();
    return `${R}${suitUnicode[unicodeToLetter[uniSuit]]}`;
  }

  // handle letter suit
  const last = raw[raw.length - 1];
  if (/[cdhs]/.test(last)) {
    const suit = suitUnicode[last as 'c' | 'd' | 'h' | 's'];
    let core = raw.slice(0, -1);
    const R =
      rankMap[core] ||
      rankMap[core.replace(/[^a-z0-9]/g, '')] ||
      core.toUpperCase();
    return `${R}${suit}`;
  }

  // already normalized like A♠?
  if (raw.length === 2 && unicodeToLetter[raw[1]]) {
    const R =
      rankMap[raw[0]] || raw[0].toUpperCase();
    return `${R}${raw[1]}`;
  }

  return null;
}

function extractEffStackBB(text: string): number | null {
  const m =
    text.match(/(\d{2,3})\s*bb\s*(?:eff|effective)?/i) ||
    text.match(/eff\s*(\d{2,3})\s*bb/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

function extractFlop(text: string): string[] | null {
  // "flop comes 4d 8s 2c", "flop 4♦ 8♠ 2♣"
  const line =
    text.match(/flop[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])/i);
  if (!line) return null;
  const c1 = normalizeOneCard(line[1]);
  const c2 = normalizeOneCard(line[2]);
  const c3 = normalizeOneCard(line[3]);
  if (c1 && c2 && c3) return [c1, c2, c3];
  return null;
}
function extractTurn(text: string): string | null {
  const m = text.match(/turn[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  if (!m) return null;
  return normalizeOneCard(m[1]);
}
function extractRiver(text: string): string | null {
  const m = text.match(/river[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  if (!m) return null;
  return normalizeOneCard(m[1]);
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1)) as T;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawText: string = (body?.rawText || '').toString();
    const position: string = (body?.position || '').toString();
    const stakes: string = (body?.stakes || '').toString();
    const villainAction: string = (body?.villainAction || '').toString();
    const cards: string = (body?.cards || '').toString();

    // Extract facts from the user’s text; if missing, leave null to avoid hallucination.
    const effStackBB = extractEffStackBB(rawText);
    const flop = extractFlop(rawText);
    const turn = extractTurn(rawText);
    const river = extractRiver(rawText);

    const facts = {
      position: position || null,
      stakes: stakes || null,
      cards: cards || null,
      effStackBB: effStackBB || null,
      flop, // array or null
      turn: turn || null,
      river: river || null,
      villainAction: villainAction || null,
    };

    // Build a tight prompt that forces these facts into the 4-line GTO summary,
    // and also returns a structured "expanded" branch map.
    const system = `
You are a poker strategy assistant. Return ONLY JSON.
Keys:
- gto_strategy (string): EXACTLY 4 lines, each keyed to street and embedding the facts we provide:
  1) "Preflop (SB vs CO, <stack>bb): 3-bet 10–12bb; Axs/A4s mixes (≈20–35%). Fold to 4-bets at this depth." (use exact stack)
  2) "Flop <C1><C2><C3> (OOP, 3-bet pot): ..." (use exact flop cards)
  3) "Turn <card>: ..." (use exact turn card)
  4) "River <card>: ..." (use exact river card)
  Keep each line specific with size guidelines (e.g., 25–33%, 50–60%, 66–75%, overbet), and how to respond to raises.
- exploit_deviation (string): 2–4 concise sentences; pool exploits only.
- learning_tag (array of 1–3 short strings).
- gto_expanded (string): a branch map with *numbered* items for Preflop / Flop / Turn / River. Under each, include size-conditioned responses (e.g., "if raised to 3–3.5× → fold", "vs 33–50% → call", "vs 66–75% → mix/fold", "vs overbet → fold"). Embed the exact board/street cards in Flop/Turn/River headers.

Style constraints:
- No markdown. No extra keys. JSON object only. No code fences.
- Must embed the provided facts verbatim where applicable (stack, flop, turn, river).
- If a fact is missing, write "unknown".
`;

    const user = {
      role: 'user' as const,
      content: JSON.stringify(
        {
          facts,
          guidance: {
            // A minimal nudge for A4s in SB vs CO; model should still reason from facts
            preflop_baseline: 'SB vs CO, 150bb typical: 3-bet 10–12bb; A4s mixes as a low-frequency bluff. Fold to 4-bets at 150bb.',
            flop_baseline:
              'OOP in 3-bet pots on low/rainbow boards: small c-bet 25–33% at decent frequency; fold to large raises with bottom pair.',
          },
        },
        null,
        2
      ),
    };

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system.trim() },
        user,
      ],
    });

    const raw = resp.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse<{
      gto_strategy?: string;
      exploit_deviation?: string;
      learning_tag?: string[];
      gto_expanded?: string;
    }>(raw);

    // Build safe response
    const out = {
      gto_strategy: (parsed?.gto_strategy || '—').toString(),
      exploit_deviation: (parsed?.exploit_deviation || '—').toString(),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed!.learning_tag.slice(0, 3).map((s) => s.toString())
        : [],
      gto_expanded: (parsed?.gto_expanded || '—').toString(),
      facts: {
        effStackBB,
        flop,
        turn,
        river,
        position: facts.position,
      },
    };

    return NextResponse.json(out);
  } catch (err: any) {
    console.error('analyze-hand error', err);
    return NextResponse.json(
      { error: 'Failed to analyze hand' },
      { status: 500 }
    );
  }
}
