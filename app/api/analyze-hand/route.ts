import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// ---------- Parsing helpers ----------
type ParsedFacts = {
  effStackBB?: number;
  flop?: string[];   // ["4♦","8♠","2♣"]
  turn?: string;     // "5♥"
  river?: string;    // "9♥"
  position?: string; // "SB" / "BTN" / ...
  stakesText?: string; // "1/3" etc
  heroHandText?: string; // "A4s" or "A♠4♠"
};

const SUIT_MAP: Record<string, string> = {
  s: '♠', h: '♥', d: '♦', c: '♣'
};

function normCard(token: string): string | null {
  // Accept "As", "a s", "ah", "4d", "T c", "10h", "Qs", etc.
  const t = token.trim().toLowerCase().replace(/[^a2-9tjqkshdc]/g, '');
  if (!t) return null;

  // ranks: a,k,q,j,t,2-9 or 10 encoded as t
  const m = t.match(/^(10|[2-9tjqka])([shdc])$/);
  if (!m) return null;

  const r = m[1].toUpperCase().replace(/^10$/,'T');
  const s = SUIT_MAP[m[2]];
  return r + s;
}

// Try “4d 8s 2c”, “flop 4d 8s 2c.”, “flop: 4♦ 8♠ 2♣” etc.
function extractFlopTurnRiver(text: string) {
  const out: { flop?: string[], turn?: string, river?: string } = {};
  const lower = text.toLowerCase();

  // Find sequences like: "flop ... 4d 8s 2c"
  const flopMatch = lower.match(/flop[^a-z0-9]*([atjqk2-9] ?[shdc])[^a-z0-9]+([atjqk2-9] ?[shdc])[^a-z0-9]+([atjqk2-9] ?[shdc])/i);
  if (flopMatch) {
    const a = normCard(flopMatch[1])!, b = normCard(flopMatch[2])!, c = normCard(flopMatch[3])!;
    if (a && b && c) out.flop = [a,b,c];
  } else {
    // fallback: any 3 card tokens right after "flop"
    const fallback = lower.match(/flop[^a-z0-9]*((?:[atjqk2-9] ?[shdc][^a-z0-9]+){3})/i);
    if (fallback) {
      const cards = (fallback[1].match(/([atjqk2-9] ?[shdc])/gi) || []).map(normCard).filter(Boolean) as string[];
      if (cards.length >= 3) out.flop = cards.slice(0,3);
    }
  }

  const turnMatch = lower.match(/turn[^a-z0-9]*([atjqk2-9] ?[shdc])/i);
  if (turnMatch) {
    const t = normCard(turnMatch[1]!); if (t) out.turn = t;
  }

  const riverMatch = lower.match(/river[^a-z0-9]*([atjqk2-9] ?[shdc])/i);
  if (riverMatch) {
    const r = normCard(riverMatch[1]!); if (r) out.river = r;
  }

  return out;
}

function extractEffStackBB(text: string): number | undefined {
  // finds "150 bb", "150bb eff", "150bb effective", etc.
  const m = text.match(/(\d{2,4})\s*bb(?:[^a-z0-9]+(?:eff|effective))?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 10000) return n;
  }
  return undefined;
}

function extractPosition(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes(' on sb') || lower.includes(' i am sb') || lower.includes(' i\'m sb') || lower.includes(' in sb')) return 'SB';
  if (lower.includes(' on bb') || lower.includes(' in bb')) return 'BB';
  if (lower.includes(' on btn') || lower.includes(' on button')) return 'BTN';
  if (lower.includes(' on cutoff') || lower.includes(' in cutoff') || lower.includes(' co ')) return 'CO';
  if (lower.includes(' on hj') || lower.includes(' hijack')) return 'HJ';
  if (lower.includes(' utg')) return 'UTG';
  return undefined;
}

function extractStakes(text: string): string | undefined {
  // simple: captures something like "1/3", "2/5"
  const m = text.match(/\b(\d+(?:\/\d+))\b/);
  return m?.[1];
}

function extractHeroHand(text: string): string | undefined {
  const lower = text.toLowerCase();
  // patterns like "a4 of spades" or "a4s"
  const m1 = lower.match(/\b(a|k|q|j|t|[2-9])\s*([2-9tjqka])\s*of\s*(spades|hearts|diamonds|clubs)\b/);
  if (m1) {
    const r1 = m1[1].toUpperCase(), r2 = m1[2].toUpperCase();
    const suitWord = m1[3][0]; // s/h/d/c
    const s = SUIT_MAP[suitWord === 's' ? 's' : suitWord === 'h' ? 'h' : suitWord === 'd' ? 'd' : 'c'];
    return `${r1}${s}${r2}${s}`;  // e.g., A♠4♠
  }
  const m2 = lower.match(/\b([akqjt2-9])([2-9tjqka])s\b/);
  if (m2) {
    return `${m2[1].toUpperCase()}${m2[2].toUpperCase()}s`; // e.g., A4s
  }
  return undefined;
}

function prettyBoardLine(flop?: string[], turn?: string, river?: string) {
  const f = flop ? flop.join(' ') : '—';
  const t = turn || '—';
  const r = river || '—';
  return { f, t, r };
}

function tryParseJSON(text: string) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}$/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// ---------- OpenAI call ----------
async function callModel(system: string, user: string) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${await resp.text()}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// ---------- Route ----------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const handText: string = body?.rawText || '';         // your textarea text (left pane)
    const uiCards: string = body?.cards || '';            // if you already parse cards in UI
    const uiPosition: string = body?.position || '';
    const uiStakes: string = body?.stakes || '';
    const uiVillain: string = body?.villainAction || '';

    // Parse facts from the free-text (robust)
    const facts: ParsedFacts = {
      effStackBB: extractEffStackBB(handText),
      ...extractFlopTurnRiver(handText),
      position: extractPosition(handText) || (uiPosition || undefined),
      stakesText: extractStakes(handText) || (uiStakes || undefined),
      heroHandText: extractHeroHand(handText) || (uiCards || undefined),
    };

    // Pretty strings for the prompt
    const board = prettyBoardLine(facts.flop, facts.turn, facts.river);
    const eff = facts.effStackBB ?? 100;

    // FACTS block the model MUST mirror
    const factsBlock = `
FACTS (must obey exactly):
- Effective Stack: ${eff}bb
- Flop: ${board.f}
- Turn: ${board.t}
- River: ${board.r}
- Position: ${facts.position || 'SB vs CO (default OOP)'}
- Stakes: ${facts.stakesText || 'live/cash'}
- Hero hand: ${facts.heroHandText || 'unknown'}
`.trim();

    const system = `
You are a poker strategy assistant. Return ONLY strict JSON with keys:
- "gto_strategy" (string): 4 lines (Preflop, Flop, Turn, River). Include sizes and brief frequencies, ≤80 words total.
- "exploit_deviation" (string): 2–4 concise sentences, ≤60 words.
- "learning_tag" (array of 1–3 short strings).
- "gto_expanded" (string): multi-line ASCII branch map with A/B/C branches and size-conditioned actions.

HARD REQUIREMENT:
Mirror the provided FACTS exactly (stack depth, board cards, position). Do not invent different stacks or cards. Put the exact flop/turn/river (with suits if given) in headers of both gto_strategy and gto_expanded.
`.trim();

    const user = `
${factsBlock}

Task:
1) "gto_strategy" four lines like:
   Preflop (SB vs CO, ${eff}bb): 3-bet 10–12bb; [hand] mixes (≈20–35%). Fold to 4-bets at this depth.
   Flop ${board.f} (OOP, 3-bet pot): Small c-bet 25–33% ≈55–65%. With [hand], ... Include sizes and mixes.
   Turn ${board.t}: Check-range guidance with sizing-conditioned responses.
   River ${board.r}: After x/c turn, ... with size-conditioned fold/call/value rules.

2) "exploit_deviation": population exploits (don’t contradict FACTS).

3) "learning_tag": 1–3 short tags.

4) "gto_expanded": A/B/C branch map with numbered sub-branches AND explicit bet sizes (bb or % pot) at each decision.
Return ONLY JSON.
`.trim();

    // First attempt
    let text = await callModel(system, user);
    let parsed = tryParseJSON(text);

    // Quick validation & one retry if facts are ignored
    const needExactStack = new RegExp(`\\b${eff}\\s*bb\\b`, 'i');
    const needFlopPiece  = facts.flop?.[0] ? new RegExp(facts.flop[0].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')) : null;

    const gStr = parsed?.gto_strategy || '';
    const gExp = parsed?.gto_expanded || '';

    const stackMissing = !needExactStack.test(gStr + '\n' + gExp);
    const flopMissing  = needFlopPiece ? !(needFlopPiece.test(gStr) || needFlopPiece.test(gExp)) : false;

    if ((!parsed || stackMissing || flopMissing) && OPENAI_API_KEY) {
      const retryUser = `
Your previous answer used incorrect facts. CORRECT it.

${factsBlock}

STRICT:
- Use exactly ${eff}bb in all stack references.
- Use exactly Flop ${board.f}, Turn ${board.t}, River ${board.r} in headers.
- Do not change suits/ranks.

Return ONLY JSON with the same keys.
`.trim();
      text = await callModel(system, retryUser);
      parsed = tryParseJSON(text);
    }

    const out = {
      gto_strategy: parsed?.gto_strategy || '—',
      exploit_deviation: parsed?.exploit_deviation || '—',
      learning_tag: Array.isArray(parsed?.learning_tag) ? parsed.learning_tag.slice(0, 3) : [],
      gto_expanded: parsed?.gto_expanded || '—'
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Analyze failed' }, { status: 500 });
  }
}
