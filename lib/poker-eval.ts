// Lightweight poker hand evaluator + tolerant card parsing.
// Supports inputs like "Kh", "K♥", "10h", "T h", "Ah Kh", etc.
// Exports: parseCard, parseMany, evaluateHeroAndBoard

export type RankSym = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type SuitSym = "s" | "h" | "d" | "c";

const RANK_ORDER: RankSym[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const RANK_TO_VAL: Record<RankSym, number> = {
  A:14, K:13, Q:12, J:11, T:10, "9":9, "8":8, "7":7, "6":6, "5":5, "4":4, "3":3, "2":2
};

// Map any suit glyph/letter to canonical SuitSym.
function normalizeSuit(ch: string): SuitSym | null {
  const c = ch.toLowerCase();
  if (c === "s" || c === "♠") return "s";
  if (c === "h" || c === "♥") return "h";
  if (c === "d" || c === "♦") return "d";
  if (c === "c" || c === "♣") return "c";
  return null;
}

// Map any rank token to canonical RankSym (accepts 10/ten/T variants).
function normalizeRank(token: string): RankSym | null {
  const t = token.trim().toUpperCase();

  // Accept "10", "T", "t" as Ten.
  if (t === "10" || t === "T") return "T";

  // Accept A,K,Q,J or digits 2-9.
  if (t.length === 1) {
    if (t === "A" || t === "K" || t === "Q" || t === "J") return t as RankSym;
    if ("23456789".includes(t)) return t as RankSym;
  }
  return null;
}

/**
 * Parse a single card string.
 * Accepts:
 *  - "Kh", "K h", "K♥"
 *  - "10h", "10 h", "Td", "T d"
 *  - "Ah", "A h", "A♥"
 */
export function parseCard(str: string): { r: number; s: SuitSym } | null {
  if (!str) return null;
  const raw = str.replace(/\s+/g, ""); // remove spaces like "K h"
  if (raw.length < 2) return null;

  // Try two styles:
  // 1) rank then suit, e.g. "Kh", "K♥", "10h"
  // 2) sometimes users paste emojis next to rank with no space; we treat last char as suit if valid

  // Extract suit candidate = last char (letter or emoji)
  const suitCandidate = raw.slice(-1);
  const suit = normalizeSuit(suitCandidate);
  if (!suit) return null;

  // Rank candidate = everything except the last char
  const rankToken = raw.slice(0, -1);
  const rankSym = normalizeRank(rankToken);
  if (!rankSym) return null;

  return { r: RANK_TO_VAL[rankSym], s: suit };
}

/**
 * Parse many cards from a free-form string.
 * Returns canonical list (up to as many as we can parse).
 */
export function parseMany(text: string): { r: number; s: SuitSym }[] {
  if (!text) return [];
  const tokens = text
    // Split on whitespace, commas, pipes and slashes but keep things like "10h"
    .split(/[\s,|/]+/)
    .filter(Boolean);

  const out: { r: number; s: SuitSym }[] = [];
  for (const t of tokens) {
    const c = parseCard(t);
    if (c) out.push(c);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Hand evaluation (7-card to best 5)                                       */
/* ------------------------------------------------------------------------ */

type Cat =
  | 1  // High Card
  | 2  // One Pair
  | 3  // Two Pair
  | 4  // Three of a Kind
  | 5  // Straight
  | 6  // Flush
  | 7  // Full House
  | 8  // Four of a Kind
  | 9; // Straight Flush

type Card = { r: number; s: SuitSym };

function byRankDesc(a: Card, b: Card) { return b.r - a.r; }

function isStraight(valuesDesc: number[]): number | null {
  // Remove duplicates
  const uniq = [...new Set(valuesDesc)];
  // Add wheel (A=14) as 1 to detect A-5 straight
  if (uniq[0] === 14) uniq.push(1);
  // Sliding window of length >=5
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) {
      if (uniq[i + j - 1] - 1 !== uniq[i + j]) { ok = false; break; }
    }
    if (ok) return uniq[i]; // high card of straight
  }
  return null;
}

function classify5(cards: Card[]) {
  const sorted = [...cards].sort(byRankDesc);
  const ranks = sorted.map(c => c.r);
  const suits = sorted.map(c => c.s);
  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] ?? 0) + 1;

  const isFlush = suits.every(s => s === suits[0]);
  const straightHi = isStraight(ranks);
  const isStraightBool = straightHi !== null;

  // Straight flush
  if (isFlush && isStraightBool) {
    return { cat: 9 as Cat, tiebreak: [straightHi!] };
  }

  // Rank multiplicities
  const byCount = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  // Four of a kind
  if (byCount[0]?.c === 4) {
    const quad = byCount[0].r;
    const kicker = sorted.find(c => c.r !== quad)!.r;
    return { cat: 8 as Cat, tiebreak: [quad, kicker] };
  }

  // Full house
  if (byCount[0]?.c === 3 && byCount[1]?.c >= 2) {
    const trips = byCount[0].r;
    const pair = byCount[1].r;
    return { cat: 7 as Cat, tiebreak: [trips, pair] };
  }

  if (isFlush) {
    return { cat: 6 as Cat, tiebreak: ranks };
  }

  if (isStraightBool) {
    return { cat: 5 as Cat, tiebreak: [straightHi!] };
  }

  if (byCount[0]?.c === 3) {
    const trips = byCount[0].r;
    const kickers = sorted.filter(c => c.r !== trips).map(c => c.r).slice(0, 2);
    return { cat: 4 as Cat, tiebreak: [trips, ...kickers] };
  }

  if (byCount[0]?.c === 2 && byCount[1]?.c === 2) {
    const topPair = Math.max(byCount[0].r, byCount[1].r);
    const botPair = Math.min(byCount[0].r, byCount[1].r);
    const kicker = sorted.find(c => c.r !== topPair && c.r !== botPair)!.r;
    return { cat: 3 as Cat, tiebreak: [topPair, botPair, kicker] };
  }

  if (byCount[0]?.c === 2) {
    const pair = byCount[0].r;
    const kickers = sorted.filter(c => c.r !== pair).map(c => c.r).slice(0, 3);
    return { cat: 2 as Cat, tiebreak: [pair, ...kickers] };
  }

  return { cat: 1 as Cat, tiebreak: ranks };
}

function compareRanks(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function best5of7(cards: Card[]) {
  let best = { cat: 1 as Cat, tiebreak: [0,0,0,0,0] as number[] };
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const pick = cards.filter((_, idx) => idx !== i && idx !== j);
      const cur = classify5(pick);
      if (
        cur.cat > best.cat ||
        (cur.cat === best.cat && compareRanks(cur.tiebreak, best.tiebreak) > 0)
      ) {
        best = cur;
      }
    }
  }
  return best;
}

function describe(cat: Cat, tiebreak: number[]) {
  const valToFace = (v: number) =>
    v === 14 ? "A" : v === 13 ? "K" : v === 12 ? "Q" : v === 11 ? "J" : v === 10 ? "T" : String(v);

  switch (cat) {
    case 9: return `Straight Flush, high ${valToFace(tiebreak[0])}`;
    case 8: return `Four of a Kind, ${valToFace(tiebreak[0])}s (kicker ${valToFace(tiebreak[1])})`;
    case 7: return `Full House, ${valToFace(tiebreak[0])}s over ${valToFace(tiebreak[1])}s`;
    case 6: return `Flush`;
    case 5: return `Straight, high ${valToFace(tiebreak[0])}`;
    case 4: return `Three of a Kind, ${valToFace(tiebreak[0])}s`;
    case 3: return `Two Pair — ${valToFace(tiebreak[0])}${valToFace(tiebreak[1])} (kicker ${valToFace(tiebreak[2])})`;
    case 2: return `One Pair — ${valToFace(tiebreak[0])}s`;
    default: return `High Card — ${valToFace(tiebreak[0])}`;
  }
}

/**
 * Evaluate hero + board arrays (any of "Kh","K♥","10h","Td" etc).
 * Returns best 5-of-7 classification + human label.
 */
export function evaluateHeroAndBoard(
  heroTokens: string[],
  boardTokens: string[]
) {
  const hero = heroTokens.map(parseCard).filter(Boolean) as Card[];
  const board = boardTokens.map(parseCard).filter(Boolean) as Card[];
  const all = [...hero, ...board].slice(0, 7);

  // Not enough cards? Return high-card-ish placeholder.
  if (all.length < 5) {
    return { score: { cat: 1 as Cat, tiebreak: [0,0,0,0,0] }, label: "Unknown — insufficient cards" };
  }

  const score = best5of7(all);
  const label = describe(score.cat, score.tiebreak);
  return { score, label };
}
