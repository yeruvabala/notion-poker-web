// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* --------------------------- Small utilities --------------------------- */

type Suit = "♠" | "♥" | "♦" | "♣";
type RankSym =
  | "A" | "K" | "Q" | "J" | "T"
  | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";

type Card = { r: RankSym; s: Suit };

const RANK_ORDER: RankSym[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const RANK_TO_VAL: Record<RankSym, number> = Object.fromEntries(
  RANK_ORDER.map((r,i)=>[r, 14 - i]) // A=14 ... 2=2
);

/** Kc, Kh, Ks, K♥, K/ h, k h → normalized {r,s} or null */
function parseCard(raw: string): Card | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();

  // Already like "K♠"
  const m0 = t.match(/^([2-9TJQKA])([♠♥♦♣])$/);
  if (m0) return { r: toRank(m0[1])!, s: m0[2] as Suit };

  // "Ks" / "K s" / "K/S"
  const m1 = t.replace(/[\s/]+/g,"").match(/^([2-9TJQKA])([SHDC])$/);
  if (m1) return { r: toRank(m1[1])!, s: toSuitAscii(m1[2])! };

  // "K of spades"
  const m2 = t.match(/^([2-9TJQKA])\s*(?:OF)?\s*(SPADES?|HEARTS?|DIAMONDS?|CLUBS?)$/i);
  if (m2) return { r: toRank(m2[1])!, s: toSuitWord(m2[2])! };

  return null;
}
function toRank(x: string): RankSym | null {
  const r = x.toUpperCase().replace("10","T");
  return (["A","K","Q","J","T","9","8","7","6","5","4","3","2"] as const).includes(r as any) ? (r as RankSym) : null;
}
function toSuitAscii(x: string): Suit | null {
  const m = x.toUpperCase();
  if (m === "S") return "♠";
  if (m === "H") return "♥";
  if (m === "D") return "♦";
  if (m === "C") return "♣";
  return null;
}
function toSuitWord(x: string): Suit | null {
  const m = x.toLowerCase();
  if (m.startsWith("spade")) return "♠";
  if (m.startsWith("heart")) return "♥";
  if (m.startsWith("diamond")) return "♦";
  if (m.startsWith("club")) return "♣";
  return null;
}
function fmt(c?: Card | null): string {
  return c ? `${c.r}${c.s}` : "";
}

/* --------------------- Draw & made-hand classification --------------------- */

type Facts = {
  node: "PREFLOP"|"FLOP"|"TURN"|"RIVER";
  posLine: string;           // "SRP, BTN vs UTG" etc
  stacks_bb?: number;        // effective stacks (bb) if provided/estimated
  pot_bb?: number;           // approximate pot (bb) if provided/estimated
  hero: {
    c1?: Card | null;
    c2?: Card | null;
    class: string;           // "top-pair", "two-pair", "set", "straight", "flush", "air", etc
    has_draws: boolean;      // any draw flag true?
    draws: {
      oesd: boolean; gutshot: boolean;
      nfd: boolean; fd: boolean;
      bdfd: boolean;
    };
    kicker: "weak"|"mid"|"strong"|"n/a";
  };
  board: {
    flop?: Card[]; turn?: Card | null; river?: Card | null;
    texture: string;         // "A-high two-tone", "paired", "monotone", etc
    highRank?: RankSym;
  };
  villain_line_hint: string; // simple text we pass in (e.g., "river check")
};

function computeFacts(body: any): Facts {
  const node = deriveNode(body?.board ?? "", body?.rawText ?? "");
  // Cards from the editable summary first; fall back to story preview.
  const heroText: string = body?.cards || "";
  const boardText: string = body?.board || "";

  const [h1s, h2s] = (heroText || "").split(/\s+/).filter(Boolean);
  const h1 = parseCard(h1s || "");
  const h2 = parseCard(h2s || "");

  const flop = extractStreet(boardText,"Flop");
  const turn = extractOne(boardText,"Turn");
  const river = extractOne(boardText,"River");

  const flopC = flop.map(parseCard).filter(Boolean) as Card[];
  const turnC = turn ? [parseCard(turn)!].filter(Boolean) as Card[] : [];
  const riverC = river ? [parseCard(river)!].filter(Boolean) as Card[] : [];

  const allBoard = [...flopC, ...turnC, ...riverC];
  const highRank = allBoard.length ? allBoard.slice(0).sort((a,b)=>RANK_TO_VAL[b.r]-RANK_TO_VAL[a.r])[0].r : undefined;

  const texture = boardTexture(flopC, turnC[0] || null, riverC[0] || null);

  const made = madeClass(h1,h2, flopC, turnC[0]||null, riverC[0]||null);
  const draws = drawFlags(h1,h2, flopC, turnC[0]||null);
  const has_draws = Object.values(draws).some(Boolean);

  const kicker = topPairKicker(h1,h2, highRank);

  const villain_line_hint = computeVillainHint(body?.rawText || body?.notes || "");

  return {
    node,
    posLine: positionLine(body?.position || "", body?.rawText || ""),
    stacks_bb: body?.eff_bb ? Number(body.eff_bb) : undefined,
    pot_bb: body?.pot_bb ? Number(body.pot_bb) : undefined,
    hero: { c1: h1, c2: h2, class: made, has_draws, draws, kicker },
    board: { flop: flopC, turn: turnC[0]||null, river: riverC[0]||null, texture, highRank },
    villain_line_hint
  };
}

function deriveNode(board: string, raw: string): Facts["node"] {
  const t = (board + " " + raw).toLowerCase();
  if (/river/.test(t)) return "RIVER";
  if (/turn/.test(t)) return "TURN";
  if (/flop/.test(t)) return "FLOP";
  return "PREFLOP";
}
function extractStreet(board: string, label: "Flop"): string[] {
  const m = board.match(new RegExp(`${label}:\\s*([^|]+)`, "i"));
  if (!m) return [];
  return m[1].trim().split(/\s+/).filter(Boolean);
}
function extractOne(board: string, label: "Turn"|"River"): string | "" {
  const m = board.match(new RegExp(`${label}:\\s*([^|]+)`, "i"));
  return m ? m[1].trim() : "";
}
function positionLine(pos: string, raw: string): string {
  const P = (pos||"").toUpperCase();
  if (P) return P;
  const t = raw.toUpperCase();
  const sides = ["BTN","CO","HJ","MP","UTG","SB","BB"];
  for (const s of sides) if (t.includes(` ${s} `)) return s;
  return "(unknown)";
}
function topPairKicker(h1: Card|null, h2: Card|null, high?: RankSym): Facts["hero"]["kicker"] {
  if (!h1 || !h2 || !high) return "n/a";
  const ranks = [h1.r, h2.r];
  if (!ranks.includes(high)) return "n/a";
  const other = ranks[0]===high ? ranks[1] : ranks[0];
  const val = RANK_TO_VAL[other];
  if (val >= 13) return "strong"; // A/K
  if (val >= 11) return "mid";    // Q/J
  return "weak";
}
function boardTexture(flop: Card[], turn: Card|null, river: Card|null): string {
  if (flop.length === 3) {
    const suits = [flop[0].s, flop[1].s, flop[2].s, turn?.s, river?.s].filter(Boolean) as Suit[];
    const set = new Set(suits);
    const twoTone = set.size===2 ? "two-tone" : set.size===1 ? "monotone" : "rainbow";
    const high = flop.slice(0).sort((a,b)=>RANK_TO_VAL[b.r]-RANK_TO_VAL[a.r])[0].r;
    const paired = (new Set([flop[0].r, flop[1].r, flop[2].r]).size !== 3) ? "paired" : "";
    return `${high}-high ${twoTone}${paired ? " paired" : ""}`.trim();
  }
  return "unknown";
}

function madeClass(h1: Card|null, h2: Card|null, f: Card[], t: Card|null, r: Card|null): string {
  if (!h1 || !h2 || f.length<3) return "unknown";
  const board = [...f, ...(t?[t]:[]), ...(r?[r]:[])];
  const ranks = [h1.r, h2.r, ...board.map(c=>c.r)];
  const counts: Record<string, number> = {};
  ranks.forEach(rr => counts[rr] = (counts[rr]||0)+1);

  // flush?
  const suitCount: Record<Suit, number> = { "♠":0,"♥":0,"♦":0,"♣":0 };
  [...[h1,h2],...board].forEach(c => { if (c) suitCount[c.s]++; });
  const flush = Object.values(suitCount).some(n => n>=5);

  // straight?
  const allVals = Array.from(new Set([...ranks].map(r=>RANK_TO_VAL[r as RankSym]).sort((a,b)=>b-a)));
  const straight = hasStraight(allVals);

  const trips = Object.values(counts).some(n=>n===3);
  const quads = Object.values(counts).some(n=>n===4);
  const pairsN = Object.values(counts).filter(n=>n===2).length;

  if (quads) return "quads";
  if (straight && flush) return "straight-flush";
  if (flush) return r ? "flush" : "flush-draw/possible";
  if (straight) return r ? "straight" : "straight-draw/possible";
  if (trips) return "set/trips";
  if (pairsN >= 2) return "two-pair";

  // top-pair?
  const boardHigh = f.slice(0).sort((a,b)=>RANK_TO_VAL[b.r]-RANK_TO_VAL[a.r])[0].r;
  if ([h1.r,h2.r].includes(boardHigh)) return "top-pair";

  if (pairsN === 1) return "pair";
  return "air";
}
function hasStraight(vals: number[]): boolean {
  // Ace wheel
  const set = new Set(vals);
  if ([14,5,4,3,2].every(v=>set.has(v))) return true;
  for (let i=0;i<=vals.length-5;i++){
    const w = vals.slice(i, i+5);
    if (w[0]-w[4]===4) return true;
  }
  return false;
}
function drawFlags(h1: Card|null, h2: Card|null, f: Card[], t: Card|null) {
  const turnIncluded = t ? [...f, t] : f;
  const suits: Record<Suit, number> = {"♠":0,"♥":0,"♦":0,"♣":0};
  turnIncluded.forEach(c => suits[c.s]++);
  const mySuitCounts: Record<Suit, number> = {"♠":0,"♥":0,"♦":0,"♣":0};
  [h1,h2].filter(Boolean).forEach(c => { if (c) mySuitCounts[c.s]++; });

  const boardMaxSuit = (Object.entries(suits).sort((a,b)=>b[1]-a[1])[0] || ["♠",0]) as [Suit, number];
  const fd = boardMaxSuit[1]===3 && (h1?.s===boardMaxSuit[0] || h2?.s===boardMaxSuit[0]);
  const nfd = fd && ((h1?.s===boardMaxSuit[0] && h1?.r==="A") || (h2?.s===boardMaxSuit[0] && h2?.r==="A"));
  const bdfd = boardMaxSuit[1]===2 && ((h1?.s===boardMaxSuit[0]) || (h2?.s===boardMaxSuit[0]));

  // OESD / gutshot: quick + safe (uses ranks only)
  const boardVals = turnIncluded.map(c=>RANK_TO_VAL[c.r]);
  const heroVals = [h1,h2].filter(Boolean).map(c=>RANK_TO_VAL[(c as Card).r]);
  const allVals = Array.from(new Set([...boardVals, ...heroVals])).sort((a,b)=>b-a);
  const oesd = hasOESD(allVals);
  const gutshot = !oesd && hasGutshot(allVals);

  return { oesd, gutshot, fd, nfd, bdfd };
}
function hasOESD(vals: number[]): boolean {
  // look for any 4 in a row
  for (let i=0;i<=vals.length-4;i++){
    const w = vals.slice(i, i+4);
    if (w[0]-w[3]===3) return true;
  }
  // Ace wheel possibility
  const set = new Set(vals);
  if ([14,5,4,3].every(v=>set.has(v))) return true;
  return false;
}
function hasGutshot(vals: number[]): boolean {
  // naive: if we can insert a missing value to make 4-in-a-row
  for (let i=0;i<=vals.length-4;i++){
    const w = vals.slice(i, i+4);
    const gap = w[0]-w[3];
    if (gap===4) return true;
  }
  // A-5-4-2 wheel-ish
  const set = new Set(vals);
  if ([14,5,4,2].every(v=>set.has(v))) return true;
  return false;
}
function computeVillainHint(raw: string): string {
  const t = raw.toLowerCase();
  if (/river[^.\n]{0,40}\bcheck/.test(t)) return "river check";
  if (/turn[^.\n]{0,40}\bbet/.test(t)) return "turn bet";
  if (/river[^.\n]{0,40}\bjam/.test(t)) return "river jam";
  return "";
}

/* --------------------------- System prompt --------------------------- */

const SYSTEM = `
You are a CASH-GAME poker coach. You MUST strictly obey "FACTS" below.
Never invent draws or hand strength not present in FACTS.

Return ONLY JSON with EXACT keys:
{
  "verdict": { "primary": {"action":"CHECK|BET|RAISE|CALL|FOLD","size":"string"}, "alternates":[{"action":"...","size":"string"}] },
  "gto_strategy": "string",            // 180–260 words, structured coaching plan (no markdown headings)
  "exploit_deviation": "string",       // 2–4 bullets
  "learning_tag": ["string","string?"] // 2–4 tags
}

CRITICAL RULES:
- Trust FACTS. If FACTS.hero.has_draws=false, do NOT say "draw" or "good draw". If FACTS.hero.class is "top-pair", treat as top-pair; if "air", treat as air; etc.
- If node = RIVER and villain_line_hint includes "river check" and Hero = top-pair with weak kicker and no strong draw blocker:
  -> verdict MUST BE MIXED: one small BET (~30–60% pot) AND CHECK. Provide both in "primary/alternates".
- If node = TURN and Hero = air (no pair; has_draws=false), facing sizable aggression with low FE, favor FOLD/CALL over JAM unless blockers/FE are clearly justified by FACTS.
- Use one-liners style sections: DECISION, SITUATION, RANGE SNAPSHOT, (FLOP|TURN|RIVER), WHY, COMMON MISTAKES, LEARNING TAGS.
- Keep it concise, prescriptive, numeric where possible (sizes, SPR, FE).
- CASH only. Ignore ICM/players-left entirely.
`;

/* ------------------------------ Handler ------------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Compute hard facts from summary (not the story).
    const facts = computeFacts(body);

    // Assemble a compact facts block for the model (stringified, no freedom).
    const factsBlock = [
      `node: ${facts.node}`,
      `pos_line: ${facts.posLine}`,
      `villain_line_hint: ${facts.villain_line_hint || "unknown"}`,
      `stacks_bb: ${facts.stacks_bb ?? "unknown"}`,
      `pot_bb: ${facts.pot_bb ?? "unknown"}`,

      `hero_cards: ${fmt(facts.hero.c1)} ${fmt(facts.hero.c2)}`.trim(),
      `hero_class: ${facts.hero.class}`,                    // top-pair / two-pair / set / air / ...
      `hero_has_draws: ${facts.hero.has_draws}`,
      `hero_draws: ${JSON.stringify(facts.hero.draws)}`,
      `hero_kicker: ${facts.hero.kicker}`,

      `board_flop: ${(facts.board.flop||[]).map(fmt).join(" ") || "(none)"}`,
      `board_turn: ${fmt(facts.board.turn) || "(none)"}`,
      `board_river: ${fmt(facts.board.river) || "(none)"}`,
      `board_texture: ${facts.board.texture}`,
      `board_highRank: ${facts.board.highRank || "(none)"}`,

      `user_raw_text: ${(body?.rawText || body?.notes || "").slice(0, 600)}`
    ].join("\n");

    // Strong nudge templates for classic marginal rivers
    const riverForceMixNudge =
      facts.node === "RIVER" &&
      facts.villain_line_hint.includes("river check") &&
      facts.hero.class === "top-pair" &&
      facts.hero.kicker !== "strong"
        ? `\nFORCE_MIX_RIVER: yes (provide BET ~40-60% pot AND CHECK; explain tradeoffs).`
        : `\nFORCE_MIX_RIVER: no.`;

    // Strong nudge against spurious turn jams with air
    const turnJamGuard =
      facts.node === "TURN" &&
      facts.hero.class === "air" &&
      !facts.hero.has_draws
        ? `\nTURN_JAM_ALLOWED: rare (prefer CALL/FOLD unless FE is clearly >50% or blockers are excellent).`
        : `\nTURN_JAM_ALLOWED: maybe.`;

    const userPrompt = `FACTS (authoritative — do not contradict):
${factsBlock}
${riverForceMixNudge}
${turnJamGuard}

TASK: Produce JSON only (see required schema). The "gto_strategy" must follow one-liner sections and match the FACTS.
If a MIXED plan is appropriate, put the more frequent action in "primary" and the other in "alternates".`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { /* fallthrough */ }

    const out = {
      verdict: parsed?.verdict && typeof parsed.verdict === "object"
        ? parsed.verdict
        : {
            primary: { action: "CHECK", size: "N/A" },
            alternates: []
          },
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: any)=>typeof t==="string" && t.trim())
        : []
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Analyze error";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ------------------------------- helpers ------------------------------- */

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") {
    return Object.entries(v).map(([k,val]) => `${k}: ${asText(val)}`).join("\n");
  }
  return String(v);
}
