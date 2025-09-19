// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* =========================================================
   Lightweight parsing + hand features for CASH games
   ========================================================= */

type Card = { r: string; s: string };
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const RANKVAL: Record<string, number> = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const SUITS = ["♠","♥","♦","♣"];

const SUIT_WORD: Record<string,string> = {
  s:"♠", spade:"♠", spades:"♠",
  h:"♥", heart:"♥", hearts:"♥",
  d:"♦", diamond:"♦", diamonds:"♦",
  c:"♣", club:"♣", clubs:"♣"
};

function normToken(tok: string): string {
  const t = (tok || "").trim();
  if (!t) return "";
  // "K♠"
  const m0 = t.match(/^([2-9tjqka])([♠♥♦♣])$/i);
  if (m0) return m0[1].toUpperCase() + m0[2];
  // "Ks" / "k s" / "K-of-spades"
  const m1 = t.replace(/[\s/]+/g,"").match(/^([2-9tjqka])([shdc])$/i);
  if (m1) return m1[1].toUpperCase() + SUIT_WORD[m1[2].toLowerCase()];
  const m2 = t.match(/^([2-9tjqka])\s*(?:of)?\s*(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m2) return m2[1].toUpperCase() + SUIT_WORD[m2[2].toLowerCase()];
  return "";
}

function parseCard(tok: string): Card | null {
  const n = normToken(tok);
  if (!n) return null;
  const r = n[0].toUpperCase();
  const s = n.slice(1);
  if (!RANKVAL[r] || !SUITS.includes(s)) return null;
  return { r, s };
}

function parseLineOfCards(line: string): Card[] {
  return (line || "")
    .split(/\s+/)
    .map(parseCard)
    .filter(Boolean) as Card[];
}

function parseBoardString(boardString: string) {
  // Expects "Flop: As Kd 4s  |  Turn: 9c  |  River: 3s" (any subset ok)
  const grab = (label: "Flop" | "Turn" | "River") => {
    const m = boardString.match(new RegExp(`${label}[^:]*:\\s*([^|\\n]+)`, "i"));
    return m ? parseLineOfCards(m[1]) : ([] as Card[]);
  };
  const flop = grab("Flop");
  const turn = grab("Turn");
  const river = grab("River");
  const all = [...flop, ...turn, ...river];
  return { flop, turn, river, all };
}

/* ---------- helper utilities ---------- */

function countsBy<T extends string | number>(arr: T[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of arr) o[String(x)] = (o[String(x)] ?? 0) + 1;
  return o;
}

function sortDesc(a: number[], b?: number[]): number[] {
  const x = [...a].sort((u,v) => v - u);
  return b ? x.slice(0, b.length) : x;
}

function uniqueRanks(cards: Card[]): string[] {
  const seen = new Set<string>();
  for (const c of cards) seen.add(c.r);
  return Array.from(seen).sort((a,b)=>RANKVAL[b]-RANKVAL[a]);
}

function boardTopRank(board: Card[]): string | null {
  const u = uniqueRanks(board);
  return u.length ? u[0] : null;
}

function isFlush(cards: Card[]): { ok: boolean; suit?: string } {
  const suitCount = countsBy(cards.map(c=>c.s));
  for (const s of SUITS) if ((suitCount[s] ?? 0) >= 5) return { ok: true, suit: s };
  return { ok: false };
}

function isStraight(cards: Card[]): boolean {
  // Ace can be low (A-2-3-4-5) too.
  const vals = Array.from(new Set(cards.map(c=>RANKVAL[c.r]))).sort((a,b)=>a-b);
  if (!vals.length) return false;
  const withWheel = vals.includes(14) ? [1, ...vals] : vals;
  let streak = 1;
  for (let i = 1; i < withWheel.length; i++) {
    if (withWheel[i] === withWheel[i-1] + 1) {
      streak++;
      if (streak >= 5) return true;
    } else if (withWheel[i] !== withWheel[i-1]) {
      streak = 1;
    }
  }
  return false;
}

function straightDrawType(cards: Card[]): "OESD" | "GUTSHOT" | "" {
  // Cheap approximation: check if we have 4 in a row with 1 gap (OESD) or inside (gutshot).
  // We'll compute on the union (board+hero) at flop/turn only.
  const vals = Array.from(new Set(cards.map(c=>RANKVAL[c.r]))).sort((a,b)=>a-b);
  const set = new Set(vals);
  const candidates: number[][] = [];
  for (let low = 2; low <= 10; low++) {
    candidates.push([low,low+1,low+2,low+3,low+4]); // 5-run
  }
  // Wheel run using Ace low
  candidates.push([1,2,3,4,5]);
  let best: "OESD" | "GUTSHOT" | "" = "";
  for (const run of candidates) {
    const have = run.filter(v => set.has(v) || (v === 1 && set.has(14)));
    const miss = 5 - have.length;
    if (miss === 1) {
      // distinguish OESD vs gutshot (missing end vs middle)
      const ends = [run[0], run[4]];
      const missingVals = run.filter(v => !set.has(v) && !(v===1 && set.has(14)));
      if (missingVals.length === 1) {
        const m = missingVals[0];
        if (m === ends[0] || m === ends[1]) best = best || "OESD";
        else best = best || "GUTSHOT";
      }
    }
  }
  return best;
}

function hasNFD(hero: Card[], union: Card[]): boolean {
  const fdSuit = SUITS.find(s => (countsBy(union.map(c=>c.s))[s] ?? 0) === 4);
  if (!fdSuit) return false;
  const aceOf = hero.find(c => c.s === fdSuit && c.r === "A");
  return !!aceOf;
}

function hasFD(union: Card[]): boolean {
  return SUITS.some(s => (countsBy(union.map(c=>c.s))[s] ?? 0) === 4);
}

function hasBDFD(hero: Card[], board: Card[]): boolean {
  // simple: hero two to a suit & board one to that suit (on flop)
  if (hero.length < 2 || board.length < 3) return false;
  if (hero[0].s !== hero[1].s) return false;
  return board.some(c => c.s === hero[0].s);
}

function classifyPairs(hero: Card[], board: Card[]) {
  // returns: {noPair, underpair, topPair, overpair, twoPair, trips, set}
  const union = [...hero, ...board];
  const countByRank = countsBy(union.map(c=>c.r));
  const boardCountByRank = countsBy(board.map(c=>c.r));
  const heroRanks = hero.map(c=>c.r);
  const boardRanks = board.map(c=>c.r);

  const top = boardTopRank(board);
  const heroHigh = Math.max(...heroRanks.map(r => RANKVAL[r]));
  const boardHigh = Math.max(...boardRanks.map(r => RANKVAL[r]));

  let pairCount = 0;
  let trips = false;
  for (const r of Object.keys(countByRank)) {
    if (countByRank[r] === 2) pairCount++;
    if (countByRank[r] === 3) trips = true;
  }

  const heroPairs: string[] = [];
  for (const r of heroRanks) {
    if ((countByRank[r] ?? 0) >= 2 && (boardCountByRank[r] ?? 0) < (countByRank[r] ?? 0)) {
      heroPairs.push(r);
    }
  }
  const madeTwoPair = heroPairs.length >= 2 || (pairCount >= 2 && heroPairs.length >= 1);

  const isTrips = trips && heroRanks.some(r => (countsBy(heroRanks)[r] ?? 0) === 2 || r in boardCountByRank);
  const isSet = heroRanks.some(r => (countsBy(heroRanks)[r] ?? 0) === 2) && boardRanks.some(r => r === heroRanks[0] || r === heroRanks[1]) ? false :
                heroRanks.some(r => (countsBy(heroRanks)[r] ?? 0) === 2) ? false :
                heroRanks.some(r => (countsBy(union.map(c=>c.r))[r] ?? 0) === 3 && (countsBy(heroRanks)[r] ?? 0) === 1);

  const hasPair =
    heroPairs.length >= 1 ||
    isTrips || isSet || madeTwoPair;

  const topPair =
    hasPair &&
    top != null &&
    heroRanks.some(r => r === top) &&
    !madeTwoPair && !isTrips && !isSet;

  const overpair =
    !topPair &&
    hero[0].r === hero[1].r &&
    heroHigh > boardHigh;

  const underpair =
    !topPair && !overpair && hero[0].r === hero[1].r && heroHigh < boardHigh;

  return {
    noPair: !hasPair,
    underpair,
    topPair,
    overpair,
    twoPair: madeTwoPair,
    trips: isTrips && !isSet,
    set: isSet
  };
}

/* ------------ MTT guard (we’re cash-only) ------------ */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","final table","bubble","itm",
    "day 1","day 2","level ","bb ante","bba","ante","pay jump","payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* -------------------- SYSTEM PROMPT -------------------- */

const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

CRITICAL CONSISTENCY:
- You will be given a FEATURES line that encodes the true board + hero hand class (top-pair, overpair, two-pair, set, straight, flush, draws, etc.).
- If the story text ever conflicts with FEATURES, TRUST FEATURES.
- Your "DECISION" must be consistent with FEATURES, street node, SPR/FE hints.

Write "gto_strategy" as a compact coaching plan with these sections IN THIS ORDER:

DECISION
- Node: Preflop | Flop | Turn | River (use the last street provided in board data).
- Action: Call / Fold / Check / Bet / Raise. If betting/raising, give a primary SIZE as % pot (and bb if obvious) and a secondary acceptable size when mixed.
- QUICK MIX: If multiple plays are viable, show a single line like "Mix: X% Bet 33 / Y% Check (rough)".

SITUATION
- One-liners: pot type (SRP/3BP), positions, effective stacks if known, pot/SPR if hinted, hero cards (if provided).

BOARD CLASS
- Name the texture (e.g., low two-tone, paired, monotone, high disconnected).
- "Range advantage: X" and "Nuts advantage: X".

RANGE SNAPSHOT
- 1 line each for Hero and Villain describing typical range after the line (value/draws).

PREFLOP / FLOP / TURN / RIVER
- Sizing family (numbers), representative value hands, representative bluffs, when to slow down, simple "vs raise" continue/fold rule.
- NEXT CARDS (for FLOP and TURN): “Best:” and “Worst:” with 2–4 examples each.

WHY
- 3–6 bullets that cite range/nuts edge, blockers/unblockers, and (if FE hint provided) the math.

COMMON MISTAKES
- 2–4 bullets on over/under-bluffing, wrong sizings, or calling too wide/narrow.

LEARNING TAGS
- 2–4 short tags like ["range-advantage","two-tone-low","spr-5","river-thin-value"].

Rules:
- CASH only; ignore players-left/ICM words entirely.
- Be prescriptive, concise, numeric. No markdown headings, no code fences.
- When info is missing, assume 100bb, standard sizings, and proceed.
- Keep "gto_strategy" ~180–260 words.
- "exploit_deviation" should be 2–4 bullets with pool exploits relevant to the spot.
`;

/* ----------------------- route handler ----------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards = "",
      board = "",
      notes = "",
      rawText = "",
      fe_hint,
      spr_hint
    }: {
      date?: string;
      stakes?: string;
      position?: string;
      cards?: string;
      board?: string;
      notes?: string;
      rawText?: string;
      fe_hint?: string;
      spr_hint?: string;
    } = body ?? {};

    // --- parse hero + board ---
    const heroCards = parseLineOfCards(cards);
    const { flop, turn, river, all: boardAll } = parseBoardString(board);
    const node = river.length ? "RIVER" : turn.length ? "TURN" : flop.length ? "FLOP" : "PREFLOP";

    // Feature extraction (approx but robust)
    const unionFlop = [...heroCards, ...flop];
    const unionTurn = [...heroCards, ...flop, ...turn];
    const unionRiver = [...heroCards, ...boardAll];
    const union = node === "RIVER" ? unionRiver : node === "TURN" ? unionTurn : unionFlop;

    const pairs = classifyPairs(heroCards, boardAll);
    const madeFlush = isFlush(union).ok;
    const madeStraight = isStraight(union);

    const drawFD = !madeFlush && hasFD(union);
    const drawNFD = !madeFlush && hasNFD(heroCards, union);
    const drawBDFD = !madeFlush && !drawFD && hasBDFD(heroCards, flop);

    const sdType = (!madeStraight && (node === "FLOP" || node === "TURN")) ? straightDrawType(union) : "";
    const drawOESD = !madeStraight && sdType === "OESD";
    const drawGUT = !madeStraight && sdType === "GUTSHOT";

    const heroSummary: string[] = [];
    if (madeFlush) heroSummary.push("flush");
    if (madeStraight) heroSummary.push("straight");
    if (pairs.set) heroSummary.push("set");
    if (pairs.trips) heroSummary.push("trips");
    if (pairs.twoPair) heroSummary.push("two-pair");
    if (pairs.overpair) heroSummary.push("overpair");
    if (pairs.topPair) heroSummary.push("top-pair");
    if (pairs.underpair) heroSummary.push("underpair");
    if (pairs.noPair && !madeStraight && !madeFlush) heroSummary.push("no-pair");
    if (drawFD) heroSummary.push("fd");
    if (drawNFD) heroSummary.push("nfd");
    if (drawBDFD) heroSummary.push("bdfd");
    if (drawOESD) heroSummary.push("oesd");
    if (drawGUT) heroSummary.push("gutshot");

    const FEATURES = [
      `NODE=${node}`,
      `HERO=${heroCards.map(c=>c.r+c.s).join(" ") || "unknown"}`,
      `BOARD=${boardAll.map(c=>c.r+c.s).join(" ") || "unknown"}`,
      `CLASS=${heroSummary.join(",") || "unknown"}`,
      spr_hint ? `SPR=${spr_hint}` : "",
      fe_hint ? `FE=${fe_hint}` : ""
    ].filter(Boolean).join(" | ");

    // Compact user block for the model
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${heroCards.map(c=>c.r+c.s).join(" ") || "(unknown)"}`,
      `Board: ${[
        flop.length ? `Flop ${flop.map(c=>c.r+c.s).join(" ")}` : "",
        turn.length ? `| Turn ${turn.map(c=>c.r+c.s).join(" ")}` : "",
        river.length ? `| River ${river.map(c=>c.r+c.s).join(" ")}` : ""
      ].filter(Boolean).join(" ") || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      ``,
      `FEATURES: ${FEATURES}`,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)"
    ].join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"]
      });
    }

    // call LLM
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    const out = {
      gto_strategy: String(parsed?.gto_strategy ?? ""),
      exploit_deviation: String(parsed?.exploit_deviation ?? ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
