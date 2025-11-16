export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

/**
 * Locked-down batch coach endpoint.
 * - Requires X-APP-TOKEN to match process.env.COACH_API_TOKEN
 * - Accepts { raw_text, date?, stakes?, position?, cards?, board?, spr_hint?, fe_hint? }
 * - Returns { gto_strategy, exploit_deviation, learning_tag }
 */

/* ---------------- tiny helpers reused from your analyzer ---------------- */
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join('\n');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join('\n');
  }
  return String(v);
}

/**
 * FIXED: high-precision tournament detection to avoid flagging cash hands.
 */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || '').toLowerCase();
  const hits: string[] = [];

  // Strong signals — these alone indicate MTT
  const strongTerms = [
    'tournament',
    'mtt',
    'icm',
    'players left',
    'final table',
    'bubble',
    'itm',
    'day 1',
    'day 2',
    'payout',
    'prize pool',
    'registration',
    'rebuy',
    're-buy',
    'addon',
    'add-on',
  ];
  for (const t of strongTerms) {
    if (text.includes(t)) hits.push(t);
  }

  // Only treat "ante" as a tournament signal if it's clearly non-zero somewhere.
  // e.g., "ante 50" or "ante: 25"
  const anteMatch = text.match(/ante[^0-9]*([1-9][0-9]*)/i);
  if (anteMatch) hits.push('ante>0');

  // Blind/level-like patterns *combined* with non-zero ante => MTT level
  // e.g. "150/300/40" with ante>0 is a strong MTT sign
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    !!anteMatch;

  if (levelLike) hits.push('level-like');

  return { isMTT: hits.length > 0, hits };
}

function detectRiverFacingCheck(text: string): boolean {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(text: string): { facing: boolean; large: boolean } {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const heroActsFirst =
    /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)/.test(riverLine);
  const facing =
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) &&
    !heroActsFirst &&
    !/\b(checks?|x)\b/.test(riverLine);
  const large =
    facing &&
    /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(
      riverLine,
    );
  return { facing, large };
}

/* ---- very light card/board rank extraction (same shape your analyzer uses) ---- */
type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_VAL: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  9: 9,
  8: 8,
  7: 7,
  6: 6,
  5: 5,
  4: 4,
  3: 3,
  2: 2,
};

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || '').toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  const c = pickRanksFromCards(cardsField || '');
  if (c.length >= 2) return c.slice(0, 2) as Rank[];
  // try to guess from text like "Ah Kh"
  const m = (rawText || '').match(
    /\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b.*?\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b/i,
  );
  if (m) return pickRanksFromCards(`${m[1]}${m[2]}`).slice(0, 2) as Rank[];
  return [];
}

// FIXED version: uses one-arg helper closing over `ranks`
function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  const ranks: Rank[] = [];

  const add = (src: string) => {
    const r = pickRanksFromCards(src);
    for (const x of r) {
      if (ranks.length < 5) ranks.push(x);
    }
  };

  add(boardField || '');

  const s = (rawText || '').toUpperCase();
  const flop = s.match(/\bFLOP[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const turn = s.match(/\bTURN[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const river = s.match(/\bRIVER[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';

  add(flop);
  add(turn);
  add(river);

  return ranks;
}

function isBoardPaired(board: Rank[]): boolean {
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2);
}
function isHeroTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  return hero.includes(topBoard);
}
function hasTripsWeakKicker(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const counts: Record<string, number> = {};
  for (const r of [...hero, ...board]) counts[r] = (counts[r] || 0) + 1;
  // "weak kicker" loosely: hero duplicates one low rank; top board not duplicated by hero
  const low = hero.find((r) => RANK_VAL[r] <= 9);
  return Object.values(counts).some((n) => n >= 3) && !!low;
}
function computeStrongKickerTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  const other = hero.find((r) => r !== topBoard);
  return hero.includes(topBoard) && !!other && RANK_VAL[other] >= 11; // J+
}

/* ------------------------ SYSTEM prompt (same spirit as UI) ------------------------ */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"]
}

General style:
- Be prescriptive, concise, solver-like.
- Keep "gto_strategy" ~180–260 words using our section order.
- Use pot-% sizes; avoid fabricated exact equities.

RIVER RULES (guardrails):
- If HINT ip_river_facing_check=true and the spot is close, output low-size bet (25–50%) frequency + check frequency, and WHEN to prefer each.
- If HINT river_facing_bet=true, consider call/fold/raise trees; if HINT river_bet_large=true weight folds/raises more often when range is capped.
- Respect FACTS booleans like board_paired, hero_top_pair, trips_weak_kicker, strong_kicker.

JSON ONLY. No prose outside the JSON.`;

/* --------------------------------- HANDLER --------------------------------- */
export async function POST(req: Request) {
  try {
    // Auth: only the worker (or you) should call this
    const token = req.headers.get('x-app-token');
    if (!process.env.COACH_API_TOKEN || token !== process.env.COACH_API_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept either the simple shape { raw_text } or the richer fields
    const body = await req.json().catch(() => ({} as any));
    const story: string = asText(body?.raw_text || body?.text || '');

    if (!story.trim()) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    const date = asText(body?.date || '');
    const stakes = asText(body?.stakes || '');
    const position = asText(body?.position || '');
    const cards = asText(body?.cards || '');
    const board = asText(body?.board || '');
    const spr_hint = asText(body?.spr_hint || '');
    const fe_hint = asText(body?.fe_hint || '');

    // same hints/facts used by your UI route
    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);

    const heroRanks = extractHeroRanks(cards, story);
    const boardRanks = extractBoardRanks(board, story);

    const boardPaired = isBoardPaired(boardRanks);
    const heroTopPair = isHeroTopPair(heroRanks, boardRanks);
    const tripsWeak = hasTripsWeakKicker(heroRanks, boardRanks);
    const strongKickerTopPair = computeStrongKickerTopPair(heroRanks, boardRanks);

    const facts = [
      `Hero ranks: ${heroRanks.join(',') || '(unknown)'}`,
      `Board ranks: ${boardRanks.join(',') || '(unknown)'}`,
      `board_paired=${boardPaired}`,
      `hero_top_pair=${heroTopPair}`,
      `trips_weak_kicker=${tripsWeak}`,
      `strong_kicker=${strongKickerTopPair}`,
    ].join(' | ');

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || 'today'}`,
      `Stakes: ${stakes || '(unknown)'}`,
      `Position: ${position || '(unknown)'}`,
      `Hero Cards: ${cards || '(unknown)'}`,
      `Board: ${board || '(unknown)'}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? 'true' : 'false'}`,
      `HINT: river_facing_bet=${riverFacingBet ? 'true' : 'false'}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? 'true' : 'false'}` : ``,
      `HINT: board_paired=${boardPaired ? 'true' : 'false'}`,
      `HINT: hero_top_pair=${heroTopPair ? 'true' : 'false'}`,
      `HINT: trips_weak_kicker=${tripsWeak ? 'true' : 'false'}`,
      `HINT: strong_kicker=${strongKickerTopPair ? 'true' : 'false'}`,
      ``,
      `FACTS: ${facts}`,
      ``,
      `RAW HAND TEXT:`,
      story.trim() || '(none provided)',
      ``,
      `FOCUS: Decide the final-street action in a solver-like way. Respect the HINTS and FACTS above.`,
    ]
      .filter(Boolean)
      .join('\n');

    // New, stricter MTT check: will NOT flag normal cash HH anymore
    const { isMTT } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          'This analyzer is CASH-GAME only. If this is a tournament (ICM/bubble/players-left), please re-enter as a cash hand (omit ICM/players-left).',
        exploit_deviation: '',
        learning_tag: ['cash-only', 'mtt-blocked'],
      });
    }

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userBlock },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: '', learning_tag: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ''),
      exploit_deviation: asText(parsed?.exploit_deviation || ''),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter(
            (t: unknown) => typeof t === 'string' && t.trim(),
          )
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error('coach/analyze-hand error:', e?.message || e);
    return NextResponse.json({ error: 'analyze failed' }, { status: 500 });
  }
}
