// app/api/analyze-hand/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- helpers ----------
const suitUnicode = { d: '♦', c: '♣', h: '♥', s: '♠' } as const;
const unicodeToLetter: Record<string, 'd' | 'c' | 'h' | 's'> = {
  '♦': 'd', '♣': 'c', '♥': 'h', '♠': 's',
};
const rankMap: Record<string, string> = {
  a: 'A', k: 'K', q: 'Q', j: 'J', t: 'T',
  '10': 'T', '9': '9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2',
};

function normalizeOneCard(tok: string): string | null {
  if (!tok) return null;
  let raw = tok.trim().toLowerCase();

  // unicode suit like "4♦"
  const u = raw.slice(-1);
  if (unicodeToLetter[u]) {
    const r = raw.slice(0, -1);
    const R = rankMap[r] || rankMap[r.replace(/[^a-z0-9]/g, '')] || r.toUpperCase();
    return `${R}${u}`;
  }

  // letter suit like "4d"
  const s = raw.slice(-1);
  if (/[cdhs]/.test(s)) {
    const suit = suitUnicode[s as 'c'|'d'|'h'|'s'];
    const core = raw.slice(0, -1);
    const R = rankMap[core] || rankMap[core.replace(/[^a-z0-9]/g, '')] || core.toUpperCase();
    return `${R}${suit}`;
  }

  return null;
}

function allMatches(re: RegExp, text: string): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = [];
  re.lastIndex = 0;
  let m: RegExpMatchArray | null;
  while ((m = re.exec(text)) !== null) out.push(m);
  return out;
}

// Prefer “… bb eff/effective”; else choose the largest “NN bb”
function extractEffStackBB(text: string): number | null {
  // prefer effective
  const eff = allMatches(/(\d{2,3})\s*bb\b[^\n]{0,20}\b(eff|effective)\b/gi, text)
    .map(m => parseInt(m[1], 10))
    .filter(n => !Number.isNaN(n));
  if (eff.length) return Math.max(...eff);

  // otherwise take max NN bb (word boundary)
  const plain = allMatches(/(\d{2,3})\s*bb\b/gi, text)
    .map(m => parseInt(m[1], 10))
    .filter(n => !Number.isNaN(n));
  if (plain.length) return Math.max(...plain);

  return null;
}

function extractFlop(text: string): string[] | null {
  const m = text.match(
    /flop[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])/i
  );
  if (!m) return null;
  const c1 = normalizeOneCard(m[1]);
  const c2 = normalizeOneCard(m[2]);
  const c3 = normalizeOneCard(m[3]);
  return c1 && c2 && c3 ? [c1, c2, c3] : null;
}
function extractTurn(text: string): string | null {
  const m = text.match(/turn[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  return m ? normalizeOneCard(m[1]) : null;
}
function extractRiver(text: string): string | null {
  const m = text.match(/river[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  return m ? normalizeOneCard(m[1]) : null;
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  } catch {}
  return null;
}

function coerceGtoStrategy(v: any): string {
  if (!v) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const pre = v.preflop || v.Preflop;
    const flp = v.flop || v.Flop;
    const trn = v.turn || v.Turn;
    const rvr = v.river || v.River;
    return [pre, flp, trn, rvr].filter(Boolean).join('\n');
  }
  return String(v);
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = String(body?.rawText || '');
    const position = String(body?.position || '');
    const stakes = String(body?.stakes || '');
    const villainAction = String(body?.villainAction || '');
    const cards = String(body?.cards || '');

    const facts = {
      position: position || null,
      stakes: stakes || null,
      cards: cards || null,
      effStackBB: extractEffStackBB(rawText),
      flop: extractFlop(rawText),
      turn: extractTurn(rawText),
      river: extractRiver(rawText),
      villainAction: villainAction || null,
    };

    const system = `
You are a poker strategy assistant. Return ONLY JSON.
Keys:
- gto_strategy (string or object): If object, use keys {preflop, flop, turn, river}. Each line must embed provided facts where available:
  "Preflop (SB vs CO, <stack>bb): …"
  "Flop <F1><F2><F3> (OOP, 3-bet pot): …"
  "Turn <card>: …"
  "River <card>: …"
- exploit_deviation (string): 2–4 concise sentences; pool exploits only.
- learning_tag (array of 1–3 short strings).
- gto_expanded (string): Numbered branch map with size-conditioned responses.

No markdown, no extra keys, JSON object only. Mirror provided facts verbatim if present; use "unknown" if absent.`;

    const user = {
      role: 'user' as const,
      content: JSON.stringify({ facts }, null, 2),
    };

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'system', content: system.trim() }, user],
    });

    const raw = resp.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse<any>(raw) || {};

    const out = {
      gto_strategy: coerceGtoStrategy(parsed.gto_strategy),
      exploit_deviation: String(parsed.exploit_deviation || '—'),
      learning_tag: Array.isArray(parsed.learning_tag)
        ? parsed.learning_tag.slice(0, 3).map((s: any) => String(s))
        : [],
      gto_expanded: String(parsed.gto_expanded || '—'),
      facts: {
        effStackBB: facts.effStackBB,
        flop: facts.flop,
        turn: facts.turn,
        river: facts.river,
        position: facts.position,
      },
    };

    return NextResponse.json(out);
  } catch (e) {
    console.error('analyze-hand error', e);
    return NextResponse.json({ error: 'Failed to analyze hand' }, { status: 500 });
  }
}
