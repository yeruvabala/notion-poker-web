// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* -------------------------- small utils & parsing -------------------------- */

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  }
  return String(v);
}

const SUIT_MAP: Record<string, "♠" | "♥" | "♦" | "♣"> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

function normalizeCard(tok: string): string {
  const t = (tok || "").trim();
  if (!t) return "";
  // Ex: "K♠"
  const m0 = t.match(/^([2-9tjqka])([♠♥♦♣])$/i);
  if (m0) return `${m0[1].toUpperCase()}${m0[2]}`;
  // Ex: "Ks" / "kc"
  const m1 = t.match(/^([2-9tjqka])([shdc])$/i);
  if (m1) return `${m1[1].toUpperCase()}${SUIT_MAP[m1[2].toLowerCase()]}`;
  // Ex: "Ah Kh"
  return "";
}

function splitCards(s: string): string[] {
  return (s || "")
    .split(/\s+/)
    .map(normalizeCard)
    .filter(Boolean);
}

type ParsedBoard = {
  flop: string[];
  turn: string[]; // single card (normalized) or empty
  river: string[]; // single card or empty
  all: string[]; // flop + turn + river
};

function parseBoard(boardLine: string): ParsedBoard {
  const out: ParsedBoard = { flop: [], turn: [], river: [], all: [] };
  const text = boardLine || "";
  // Accept formats like: "Flop: Kd 5h 2s  |  Turn: Qs  |  River: 7d"
  const grab = (label: "flop" | "turn" | "river") => {
    const m = text.match(new RegExp(`${label}\\s*:\\s*([^|\\n]+)`, "i"));
    if (!m) return [];
    return splitCards(m[1]);
  };
  out.flop = grab("flop");
  out.turn = grab("turn");
  out.river = grab("river");
  out.all = [...out.flop, ...out.turn, ...out.river];
  return out;
}

function suitOf(card: string): "♠" | "♥" | "♦" | "♣" | "" {
  const s = card.slice(-1);
  return s === "♠" || s === "♥" || s === "♦" || s === "♣" ? s : "";
}

function countSuits(cards: string[]): Record<string, number> {
  const c: Record<string, number> = { "♠": 0, "♥": 0, "♦": 0, "♣": 0 };
  for (const card of cards) {
    const s = suitOf(card);
    if (s) c[s] += 1;
  }
  return c;
}

function isThreeOrMoreFlush(cards: string[]): { yes: boolean; suit: string } {
  const counts = countSuits(cards);
  let suit = "";
  let max = 0;
  for (const k of Object.keys(counts)) {
    if (counts[k] > max) {
      max = counts[k];
      suit = k;
    }
  }
  return { yes: max >= 3, suit };
}

function heroHasSuit(heroCards: string[], suit: string): boolean {
  return heroCards.some((c) => suitOf(c) === suit);
}

// extremely light tournament detector (we’re cash only)
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament",
    "mtt",
    "icm",
    "players left",
    "final table",
    "bubble",
    "itm",
    "day 1",
    "day 2",
    "level ",
    "bb ante",
    "bba",
    "ante",
    "pay jump",
    "payout",
  ];
  const hits = terms.filter((t) => text.includes(t));
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ------------------------------ SYSTEM prompt ------------------------------ */

const SYSTEM = `
You are a CASH-GAME NLH coach. CASH ONLY. Output JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"],
  "verdict": "string",            // primary action like CHECK / BET / CALL / FOLD / RAISE / JAM
  "size_hint": "string",          // e.g. "33%" or "jam" or "pot"
  "confidence": "0-1",            // string number 0..1
  "pot_odds": "N/A or e.g. 30%"   // if deducible, else "N/A"
}

STRICT GUARDRAILS (CASH):
- Only recommend turn/river BLUFF-JAMS (raise/jam with air/draws) if BOTH are true:
  (i) FE_needed ≤ ~60% (use provided FE hint when available; if unknown, assume NEEDS HIGH FE → avoid jam),
  (ii) Proper blockers are present (e.g., on 3-flush/4-flush boards, Hero holds that suit A/K; vs two-pair/sets, Hero removes nutted combos).
- On 3-flush or 4-flush textures without the flush blocker, DO NOT choose a bluff-jam. Prefer CALL/FOLD lines explained by pot odds and blockers.
- Do NOT assume optimistic fold equity when fe_hint is absent. Be conservative.
- Use "MIXED" only when EVs are close; otherwise pick the single best line.
- River LAST TO ACT: a CHECK can be for pot control (not to induce). If you say CHECK at river as last to act, make that clear.

Write "gto_strategy" as a compact coaching plan with these sections in this order:
DECISION
- Node (street) and final Action (one): Check / Bet (give % pot) / Call / Fold / Raise (size) / Jam.
- If MIXED: give approximate split and sizes.
- Pot odds line if available.

SITUATION
- One-liners: SRP/3BP, positions, effective stacks, pot and/or SPR, hero hand class if provided.

RANGE SNAPSHOT
- 1 short line each for Hero and Villain (range after the line taken).

PREFLOP / FLOP / TURN / RIVER (only the relevant streets)
- Sizing family, value classes, bluffs/semi-bluffs, slowdowns/check-backs, vs-raise continue rule.

NEXT CARDS (for Flop/Turn)
- Best/Worst runouts.

WHY
- 3–6 bullets. Include blockers/unblockers, FE math if fe_hint given, and pot-odds if applicable.

COMMON MISTAKES
- 2–4 bullets that warn about over/under-bluffing, sizing, or calling too wide/narrow.

Rules:
- CASH only; ignore ICM/players-left entirely.
- Be prescriptive, not narrative. Concise bullets; no markdown headings, no code blocks.
- If information is missing, make conservative assumptions and avoid reckless jams.
- Keep "gto_strategy" ~180–260 words.
`;

/* --------------------------------- handler --------------------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards, // "K♠ T♥" style from the UI, may be empty
      board = "", // "Flop: Ks 5h 2s | Turn: Qs | River: 7d"
      notes = "",
      rawText = "",
      fe_hint, // FE % string from UI calc (optional)
      spr_hint, // from UI (optional)
      risk = "", // bb (optional, UI FE inputs)
      reward = "", // bb (optional)
      eff_stack = "", // "40bb" string if UI filled (optional)
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
      risk?: string;
      reward?: string;
      eff_stack?: string;
    } = body ?? {};

    // Conservative FE: if not supplied, pass a defensive hint (helps prevent fantasy-jam).
    const feHint = fe_hint && fe_hint.trim() ? fe_hint.trim() : "≥60% (conservative if unknown)";
    const sprHint = spr_hint && spr_hint.trim() ? spr_hint.trim() : "";

    // Build user block
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Positions: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      eff_stack ? `Effective stack: ${eff_stack}` : ``,
      sprHint ? `SPR hint: ${sprHint}` : ``,
      `FE hint: ${feHint}`,
      risk ? `Risk (bb): ${risk}` : ``,
      reward ? `Reward (bb): ${reward}` : ``,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)",
      ``,
      // nudge to choose last street if user is asking; be precise about last-to-act
      `FOCUS: Choose the DECISION for the final street the user’s question implies. If last to act on river, CHECK means pot control (not for induce). Respect guardrails for bluff-jams.`,
    ]
      .filter(Boolean)
      .join("\n");

    // Cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
        verdict: "N/A",
        size_hint: "N/A",
        confidence: "0",
        pot_odds: "N/A",
      });
    }

    // Call LLM
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
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Normalize result
    let gto = asText(parsed?.gto_strategy || "");
    const exploit = asText(parsed?.exploit_deviation || "");
    const tags: string[] = Array.isArray(parsed?.learning_tag)
      ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
      : [];

    let verdict = String(parsed?.verdict || "").toUpperCase();
    let size_hint = String(parsed?.size_hint || "");
    let confidence = String(parsed?.confidence ?? "");
    let pot_odds = String(parsed?.pot_odds ?? "N/A");

    /* ---------------------------- post-processing ---------------------------- */
    // Veto bad bluff-jams on 3+/4+/5-flush boards without the flush blocker or FE support.
    // Heuristics apply only if the model suggested JAM/SHOVE/ALL-IN or "raise jam" on turn/river.
    const boardObj = parseBoard(board);
    const heroCards = splitCards(cards || "");
    const threePlus = isThreeOrMoreFlush(boardObj.all); // any street with ≥3 of a suit
    const heroHasFlushSuit = threePlus.suit ? heroHasSuit(heroCards, threePlus.suit) : false;

    const textLC = gto.toLowerCase();
    const looksLikeJam =
      verdict === "JAM" ||
      /jam|shove|all-?in/.test(textLC) ||
      (verdict === "RAISE" && /jam|all-?in/.test(textLC));

    const riverMentioned = /river/i.test(gto);
    const turnMentioned = /turn/i.test(gto);
    const streetLikelyTurnOrRiver = riverMentioned || turnMentioned;

    // Conservative FE read from hint (extract % if present)
    const feNum = (() => {
      const m = (feHint || "").match(/(\d+(?:\.\d+)?)\s*%/);
      return m ? parseFloat(m[1]) : NaN;
    })();

    const feIsHighOrUnknown = !isFinite(feNum) || feNum >= 60;

    const jamIsBluffyByText =
      /bluff/.test(textLC) || /semi-bluff/.test(textLC) || /apply pressure/.test(textLC);

    if (
      looksLikeJam &&
      streetLikelyTurnOrRiver &&
      jamIsBluffyByText &&
      threePlus.yes &&
      !heroHasFlushSuit &&
      feIsHighOrUnknown // lacking low FE hint
    ) {
      // Veto the jam → set to FOLD (or CALL if you prefer conservative call with decent price).
      const override = [
        `DECISION OVERRIDE: Fold.`,
        `Reason: Bluff-jam vetoed by guardrails — ${threePlus.suit}-flush board without blocker; FE hint is high/unknown. Choose a conservative line instead of jam.`,
      ].join("\n");

      // Rewrite the DECISION section at the top; simplest: prepend override and keep the rest.
      gto = `${override}\n\n${gto}`;
      verdict = "FOLD";
      size_hint = "N/A";
      if (!confidence) confidence = "0.55";
    }

    const out = {
      gto_strategy: gto,
      exploit_deviation: exploit,
      learning_tag: tags,
      verdict: verdict || "N/A",
      size_hint: size_hint || "N/A",
      confidence: confidence || "0.6",
      pot_odds: pot_odds || "N/A",
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
