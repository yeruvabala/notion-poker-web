// app/lib/poker-eval.ts
// 7-card hand evaluator with robust rank parsing (Kh / K♥ / K h / "10" -> T)
// Produces a comparable score tuple + a nice human-readable description.

export type RankSym = "A"|"K"|"Q"|"J"|"T"|"9"|"8"|"7"|"6"|"5"|"4"|"3"|"2";

const RANKS: RankSym[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const RVAL: Record<RankSym, number> = {
  A:14, K:13, Q:12, J:11, T:10, "9":9, "8":8, "7":7, "6":6, "5":5, "4":4, "3":3, "2":2
};
const RSTR = (v:number): RankSym =>
  (v===14?"A":v===13?"K":v===12?"Q":v===11?"J":v===10?"T":String(v)) as RankSym;

const SUIT_CHARS = ["s","h","d","c","♠","♥","♦","♣"];

export type Card = { r: number; s: string }; // r ∈ [2..14], s ∈ {s/h/d/c/♠/♥/♦/♣}

/** Parse a single card token (Kh, K♥, K h, 10d, T♦, etc.). Unknown suit defaults to 'x'. */
export function parseCard(token: string): Card | null {
  if (!token) return null;
  const t = token.trim().replace(/\s+/g, "");
  // Extract rank
  let rank: RankSym | null = null;
  // handle "10" -> "T"
  if (/^10/i.test(t)) rank = "T";
  else {
    const m = t.match(/[AKQJT2-9]/i);
    if (m) {
      const ch = m[0].toUpperCase();
      rank = (ch === ch.toUpperCase() ? ch : ch.toUpperCase()) as RankSym;
      if (rank === "1") rank = "T" as RankSym;
      if (rank === "0") rank = "T" as RankSym;
      if (rank === "t") rank = "T" as RankSym;
    }
  }
  if (!rank) return null;

  // Extract suit if present; otherwise 'x' (unknown)
  let suit = "x";
  const ms = t.match(/[shdc♠♥♦♣]/i);
  if (ms && SUIT_CHARS.includes(ms[0])) suit = ms[0];

  return { r: RVAL[rank], s: suit };
}

export function parseMany(input: string): Card[] {
  // Split on spaces / commas / pipes
  return input
    .split(/[\s,|/]+/)
    .map(parseCard)
    .filter((c): c is Card => !!c);
}

/** Utility: choose k from array (small N; this is fine for 7 choose 5) */
function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const rec = (i: number, need: number) => {
    if (need === 0) { out.push(cur.slice()); return; }
    for (let j = i; j <= arr.length - need; j++) {
      cur.push(arr[j]);
      rec(j+1, need-1);
      cur.pop();
    }
  };
  rec(0, k);
  return out;
}

/** Category ordering (higher is better). */
const CAT = {
  High: 1,
  Pair: 2,
  TwoPair: 3,
  Trips: 4,
  Straight: 5,
  Flush: 6,
  FullHouse: 7,
  Quads: 8,
  StraightFlush: 9,
} as const;
type CatKey = keyof typeof CAT;

type Score = {
  cat: number;
  // tie-break vector (lexicographically compared, length depends on cat)
  tb: number[];
  // for description
  ranks: number[]; // sorted desc 5 ranks of the 5-card hand
  isFlush: boolean;
  isStraight: boolean;
};

/** Compare two scores (return >0 if a>b) */
function cmpScore(a: Score, b: Score): number {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const L = Math.max(a.tb.length, b.tb.length);
  for (let i=0;i<L;i++) {
    const av = a.tb[i] ?? 0, bv = b.tb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function isFlush(cards: Card[]): boolean {
  const s = cards.map(c=>c.s).filter(x=>x!=="x");
  if (s.length < 5) return false; // unclear suits -> assume not flush
  const by = new Map<string, number>();
  for (const v of s) by.set(v, 1+(by.get(v)??0));
  for (const v of by.values()) if (v>=5) return true;
  return false;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.r, 1+(m.get(c.r)??0));
  return m;
}

function straightHigh(cards: Card[]): number | 0 {
  // Unique ranks desc
  const u = Array.from(new Set(cards.map(c=>c.r))).sort((a,b)=>b-a);
  // Add wheel (A as 1) if A present
  if (u.includes(14)) u.push(1);
  let run = 1;
  for (let i=1;i<u.length;i++) {
    if (u[i] === u[i-1]-1) {
      run++;
      if (run>=5) return Math.max(u[i-1]+4, 5); // return high rank (A-high straight -> 14)
    } else if (u[i] !== u[i-1]) {
      run = 1;
    }
  }
  return 0;
}

/** Evaluate a 5-card hand into a Score. */
function eval5(cards: Card[]): Score {
  const rs = cards.map(c=>c.r).sort((a,b)=>b-a);
  const flush = isFlush(cards);
  const sh = straightHigh(cards);

  // Straight/Flush detection needs exact 5 cards: for flush, ensure all 5 same suit.
  let allSameSuit = false;
  if (flush) {
    const suit = cards[0].s;
    allSameSuit = cards.every(c=>c.s===suit);
  }

  const counts = rankCounts(cards);
  const groups = Array.from(counts.entries()).sort((a,b)=>{
    // sort by count desc then rank desc
    if (b[1] !== a[1]) return b[1]-a[1];
    return b[0]-a[0];
  });
  const byCount = groups.map(([r,c])=>({r,c}));

  // Straight Flush
  if (allSameSuit && sh) {
    return { cat: CAT.StraightFlush, tb:[sh], ranks: rs, isFlush:true, isStraight:true };
  }
  // Quads
  if (byCount[0]?.c === 4) {
    const quad = byCount[0].r;
    const kicker = Math.max(...rs.filter(x=>x!==quad));
    return { cat: CAT.Quads, tb:[quad, kicker], ranks: rs, isFlush:false, isStraight:false };
  }
  // Full House
  if (byCount[0]?.c === 3 && byCount[1]?.c >= 2) {
    const trips = byCount[0].r;
    const pair = byCount[1].r;
    return { cat: CAT.FullHouse, tb:[trips, pair], ranks: rs, isFlush:false, isStraight:false };
  }
  // Flush
  if (allSameSuit) {
    return { cat: CAT.Flush, tb: rs, ranks: rs, isFlush:true, isStraight:false };
  }
  // Straight
  if (sh) {
    return { cat: CAT.Straight, tb:[sh], ranks: rs, isFlush:false, isStraight:true };
  }
  // Trips
  if (byCount[0]?.c === 3) {
    const trips = byCount[0].r;
    const kickers = rs.filter(x=>x!==trips).slice(0,2);
    return { cat: CAT.Trips, tb:[trips, ...kickers], ranks: rs, isFlush:false, isStraight:false };
  }
  // Two Pair
  if (byCount[0]?.c === 2 && byCount[1]?.c === 2) {
    const [p1, p2] = [byCount[0].r, byCount[1].r].sort((a,b)=>b-a);
    const kicker = Math.max(...rs.filter(x=>x!==p1 && x!==p2));
    return { cat: CAT.TwoPair, tb:[p1,p2,kicker], ranks: rs, isFlush:false, isStraight:false };
  }
  // Pair
  if (byCount[0]?.c === 2) {
    const pr = byCount[0].r;
    const ks = rs.filter(x=>x!==pr).slice(0,3);
    return { cat: CAT.Pair, tb:[pr, ...ks], ranks: rs, isFlush:false, isStraight:false };
  }
  // High card
  return { cat: CAT.High, tb: rs, ranks: rs, isFlush:false, isStraight:false };
}

/** Best 5 out of up to 7 cards. Returns the top Score. */
export function best5ofN(all: Card[]): Score {
  const picks = combos(all, 5);
  let best = eval5(picks[0]);
  for (let i=1;i<picks.length;i++) {
    const sc = eval5(picks[i]);
    if (cmpScore(sc, best) > 0) best = sc;
  }
  return best;
}

/** Pretty description like "Two Pair — Aces and Kings, kicker Queen" */
export function describe(score: Score): string {
  const name = ((): CatKey => {
    for (const k in CAT) if (CAT[k as CatKey] === score.cat) return k as CatKey;
    return "High";
  })();

  const labelRank = (v:number) => {
    const s = RSTR(v);
    return s==="A"?"Ace":s==="K"?"King":s==="Q"?"Queen":s==="J"?"Jack":s==="T"?"Ten":s;
  };

  switch (name) {
    case "StraightFlush":
      return `Straight Flush — high card ${labelRank(score.tb[0])}`;
    case "Quads":
      return `Four of a Kind — ${labelRank(score.tb[0])}s, kicker ${labelRank(score.tb[1])}`;
    case "FullHouse":
      return `Full House — ${labelRank(score.tb[0])}s over ${labelRank(score.tb[1])}s`;
    case "Flush":
      return `Flush — ${score.tb.map(labelRank).map(w=>w).join(", ")}`;
    case "Straight":
      return `Straight — high card ${labelRank(score.tb[0])}`;
    case "Trips":
      return `Three of a Kind — ${labelRank(score.tb[0])}s, kickers ${labelRank(score.tb[1])}, ${labelRank(score.tb[2])}`;
    case "TwoPair":
      return `Two Pair — ${labelRank(score.tb[0])}s and ${labelRank(score.tb[1])}s, kicker ${labelRank(score.tb[2])}`;
    case "Pair":
      return `One Pair — ${labelRank(score.tb[0])}s, kickers ${labelRank(score.tb[1])}, ${labelRank(score.tb[2])}, ${labelRank(score.tb[3])}`;
    case "High":
    default:
      return `High Card — ${labelRank(score.tb[0])}, then ${labelRank(score.tb[1])}, ${labelRank(score.tb[2])}, ${labelRank(score.tb[3])}, ${labelRank(score.tb[4])}`;
  }
}

/** Convenience: evaluate hero+board (strings or Card[]) */
export function evaluateHeroAndBoard(hero: (string|Card)[], board: (string|Card)[]) {
  const toCard = (x:string|Card)=> typeof x==="string" ? parseCard(x) : x;
  const hc = hero.map(toCard).filter(Boolean) as Card[];
  const bc = board.map(toCard).filter(Boolean) as Card[];
  const score = best5ofN([...hc, ...bc]);
  return { score, label: describe(score) };
}
