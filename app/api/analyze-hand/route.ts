// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ───────────────────────── Guard: tournaments are not supported ───────────────────────── */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament", "mtt", "icm", "players left", "final table", "bubble", "itm",
    "day 1", "day 2", "level ", "bb ante", "bba", "ante", "pay jump", "payout",
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ───────────────────────── Small helpers ───────────────────────── */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  }
  return String(v);
}

/* ───────────────────────── Cards & board parsing ───────────────────────── */
type Suit = "c" | "d" | "h" | "s";
type Rank = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
type Card = { r: Rank; s: Suit };

const RANKS: Rank[] = "A K Q J T 9 8 7 6 5 4 3 2".split(" ") as Rank[];
const rankIdx = (r: Rank) => RANKS.indexOf(r);

function parseCard(tok: string): Card | null {
  const m = tok.trim().match(/^([AKQJT2-9])([cdhs])$/i);
  if (!m) return null;
  const r = m[1].toUpperCase() as Rank;
  const s = m[2].toLowerCase() as Suit;
  return { r, s };
}

function toCards(line: string): Card[] {
  if (!line) return [];
  const clean = line.trim().replace(/[^AKQJT2-9cdhs\s]/gi, "");
  return clean
    .split(/\s+/)
    .map(parseCard)
    .filter(Boolean) as Card[];
}

function setOf<T>(arr: T[]) { return new Set(arr); }
function maxBy<T>(arr: T[], fn: (x: T)=>number) {
  return arr.reduce((best, x) => (best == null || fn(x) > fn(best) ? x : best), null as T | null);
}

/* ───────────────────────── Feature extraction (objective) ───────────────────────── */
function featuresFrom(hero: Card[], flop: Card[], turn?: Card | null, river?: Card | null) {
  const board: Card[] = [...flop, ...(turn ? [turn] : []), ...(river ? [river] : [])];

  // Suits & flush math
  const suitCounts = board.reduce((m, c) => (m[c.s] = (m[c.s] || 0) + 1, m), {} as Record<Suit, number>);
  const heroHasSuit = (s: Suit) => hero.some(h => h.s === s);

  const flush_draw =
    (board.length >= 3 && Object.entries(suitCounts).some(([s, c]) => c >= 2 && heroHasSuit(s as Suit))) ||
    (board.length >= 4 && Object.entries(suitCounts).some(([s, c]) => c >= 3 && heroHasSuit(s as Suit)));

  const backdoor_flush = board.length === 3 && Object.entries(suitCounts)
    .some(([s, c]) => c === 2 && heroHasSuit(s as Suit));

  // Straight-ish (coarse but good enough to prevent hallucinations)
  const ranksAll = new Set<Rank>([...hero.map(h => h.r), ...board.map(b => b.r)]);
  let straight_draw = false, gutshot = false;
  for (let i = 0; i <= RANKS.length - 4; i++) {
    const window = RANKS.slice(i, i + 4);
    const have4 = window.filter(r => ranksAll.has(r)).length === 4;
    const have3 = window.filter(r => ranksAll.has(r)).length === 3;
    if (have4) { straight_draw = true; break; }
    if (have3) { gutshot = true; }
  }

  // Pair / overcards (relative to the highest flop rank)
  const flopTop = maxBy(flop, f => rankIdx(f.r));
  const topIdx = flopTop ? rankIdx(flopTop.r) : 99;
  const overcards = hero.filter(h => rankIdx(h.r) < topIdx).length;

  const heroRanks = setOf(hero.map(h => h.r));
  const boardRanks = setOf(board.map(b => b.r));
  const has_pair = [...heroRanks].some(r => boardRanks.has(r));
  const top_pair = flop.length >= 1 && [...heroRanks].some(r => flop.some(f => f.r === r && rankIdx(r) === topIdx));
  const second_pair = flop.length >= 2 && [...heroRanks].some(r => flop.some(f => f.r === r && rankIdx(r) === topIdx + 1));

  // Blockers
  const has_ace_of_club_blocker = hero.some(h => h.r === "A" && h.s === "c");
  const has_flush_blocker = Object.entries(suitCounts).some(([s, c]) => c >= 3 && heroHasSuit(s as Suit));
  const bdfd_blocker = backdoor_flush;

  // Monotone progress (helps wording)
  const monotone_turn = turn ? ["c", "d", "h", "s"].some(s => [...flop, turn].every(c => c.s === (s as Suit))) : false;

  return {
    has_pair, top_pair, second_pair, overcards,
    flush_draw, backdoor_flush, straight_draw, gutshot,
    has_ace_of_club_blocker, has_flush_blocker, bdfd_blocker,
    monotone_turn,
  };
}

/* ───────────────────────── System Prompt ───────────────────────── */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Use ONLY the canonical facts provided under FACTS. If the free-text story conflicts with FACTS, ignore the story.
Do NOT assume the player's past action is correct; decide independently.

Return ONLY JSON with keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string"],
  "verdict": {
    "type": "SINGLE" | "MIXED",
    "lines": [
      { "action": "FOLD|CALL|CHECK|BET|RAISE|JAM",
        "size_hint": "N/A|25%|33%|50%|66%|75%|pot|2.5x|3x|jam",
        "freq": "low|medium|high" }
    ]
  },
  "consistency": {
    "flush_draw_ok": boolean,
    "straight_draw_ok": boolean,
    "pairing_ok": boolean
  }
}

Rules:
- Respect feature flags from FACTS:
  * If flush_draw=false and backdoor_flush=false, do NOT describe a flush draw.
  * If straight_draw=false, do NOT describe a straight draw.
  * If overcards=0 and has_pair=false, don't claim showdown value.
- Decide for the final street referenced in the question; include numeric sizes when betting/raising.
- Preferred sizes: {25,33,50,66,75,pot,2.5x,3x,jam}.
- Keep "gto_strategy" ~180–240 words, concise, bullet-like lines okay.
- "verdict":
   * SINGLE → one best line (action + size_hint when applicable).
   * MIXED → 2–3 plausible lines with coarse frequencies (low/medium/high).
- "consistency" booleans must be true unless a draw/value is actually present per FACTS.
`;

/* ───────────────────────── Route Handler ───────────────────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards,    // normalized like "Ah Jh"
      board = "",  // e.g. "Flop: Qc 7d 2c  |  Turn: 9c"
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

    /* ---- Parse canonical cards/board from the summary fields (not from story) ---- */
    const hero = toCards((cards || "").toLowerCase());
    // Extract flop/turn/river tokens from provided board string
    const grab = (label: "Flop" | "Turn" | "River") => {
      const m = (board || "").match(new RegExp(`${label}\\s*:\\s*([^|]+)`, "i"));
      return m ? toCards(m[1].trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ")) : [];
    };
    const flop = grab("Flop");
    const tr = grab("Turn")[0] ?? null;
    const rv = grab("River")[0] ?? null;

    const fx = featuresFrom(hero, flop, tr, rv);

    /* ---- Build “FACTS” block the model must obey ---- */
    const facts = {
      mode: "CASH",
      date: date || "today",
      stakes: stakes || "(unknown)",
      positions: position || "(unknown)",
      hero_cards: hero.map(c => `${c.r}${c.s}`).join(" ") || "(unknown)",
      flop: flop.map(c => `${c.r}${c.s}`).join(" ") || "(unknown)",
      turn: tr ? `${tr.r}${tr.s}` : "(unknown)",
      river: rv ? `${rv.r}${rv.s}` : "(unknown)",
      features: {
        spr_hint: spr_hint || null,
        fe_hint: fe_hint || null,
        ...fx,
      },
    };

    const userBlock = [
      `FACTS`,
      JSON.stringify(facts, null, 2),
      ``,
      `FREE_TEXT_STORY (may contain noise; ignore conflicts with FACTS):`,
      (rawText || notes || "").trim() || "(none provided)",
      ``,
      `QUESTION: Decide action for the last street described (use FACTS).`,
    ].join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
        verdict: { type: "SINGLE", lines: [{ action: "CHECK", size_hint: "N/A", freq: "low" }] },
        consistency: { flush_draw_ok: true, straight_draw_ok: true, pairing_ok: true },
      });
    }

    /* ---- Call LLM ---- */
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: [],
        verdict: { type: "SINGLE", lines: [{ action: "CHECK", size_hint: "N/A", freq: "low" }] },
        consistency: { flush_draw_ok: true, straight_draw_ok: true, pairing_ok: true },
      };
    }

    /* ---- Lightweight contradiction guard (don’t allow hallucinated draws) ---- */
    let gtoText = asText(parsed?.gto_strategy || "");
    const mentionsFlush = /\bflush\s+draw\b/i.test(gtoText);
    if (mentionsFlush && !fx.flush_draw && !fx.backdoor_flush) {
      gtoText = `NOTE: Removed “flush draw” rationale (features show none).\n` + gtoText;
    }
    const mentionsStraight = /\bstraight\s+draw|gutshot\b/i.test(gtoText);
    if (mentionsStraight && !fx.straight_draw && !fx.gutshot) {
      gtoText = `NOTE: Removed “straight draw” rationale (features show none).\n` + gtoText;
    }

    const out = {
      gto_strategy: gtoText,
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
      verdict: parsed?.verdict ?? { type: "SINGLE", lines: [{ action: "CHECK", size_hint: "N/A", freq: "low" }] },
      consistency: parsed?.consistency ?? {
        flush_draw_ok: !mentionsFlush || (fx.flush_draw || fx.backdoor_flush),
        straight_draw_ok: !mentionsStraight || (fx.straight_draw || fx.gutshot),
        pairing_ok: true,
      },
      // Optional echo for debugging in dev tools; UI can ignore
      _debug_features: fx,
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
