// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ------------ tournament detector (guard: we are cash-only) ------------ */
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

/* ----------------------- small helpers ----------------------- */
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

/* ----------------------- NEW: canonicalize hero cards ----------------------- */
function canonSuitToken(tok: string): string {
  const m = tok.trim().match(/^([2-9tjqka])([shdc♥♦♣♠])?$/i);
  if (!m) return "";
  const rank = m[1].toUpperCase();
  const s = (m[2] || "").toLowerCase();
  const SM: Record<string, string> = {
    s: "♠", h: "♥", d: "♦", c: "♣",
    "♠": "♠", "♥": "♥", "♦": "♦", "♣": "♣"
  };
  return s ? `${rank}${SM[s] ?? ""}` : rank;
}

function canonCardsFromRaw(cards?: string, raw?: string): string {
  const tryLine = (txt: string) => {
    const m = txt.toLowerCase().match(/\b(hero|i)\b[^.\n]{0,40}?\b(has|holding|holds|with|have)\b([^.\n]+)/i);
    const src = m ? m[3] : txt;
    // pick first two card-like tokens
    const arr = Array.from(src.matchAll(/\b([2-9tjqka])[shdc♥♦♣♠]|\b([2-9tjqka])\b/ig)).map(x => x[0]).slice(0, 2);
    if (arr.length === 2) {
      const a = canonSuitToken(arr[0]);
      const b = canonSuitToken(arr[1]);
      if (a && b) return `${a} ${b}`;
    }
    return "";
  };

  // Prefer explicit `cards` if user supplied
  const direct = (cards || "").trim();
  if (direct) {
    const parts = direct.split(/\s+/).slice(0, 2).map(canonSuitToken).filter(Boolean);
    if (parts.length === 2) return parts.join(" ");
  }
  // Try deriving from raw story
  return tryLine(raw || "");
}

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY. 
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"],
  "verdict": "string?",
  "alts": [{"verdict":"string","weight":"string","size_hint":"string"}]?
}

Write "gto_strategy" as a compact, structured coaching plan with these sections IN THIS ORDER:

DECISION
- Node: Preflop | Flop | Turn | River (choose the node the user is asking about; if unclear, use the last street described in the raw text).
- Action: one of Call / Fold / Check / Bet / Raise. If betting/raising, give a primary SIZE as % pot (and bb if obvious) and, if appropriate, a secondary acceptable size.
- Quick reasons: 2–4 mini bullets (e.g., value vs worse, bluff candidates you unblock, fold-equity expectation).
- If the spot is close, or mixed lines exist, **return a "verdict" and at least one alternative** in "alts" with a rough weight like "mix (60/40)". Keep the JSON valid.
- If pot odds are explicit (or easily deduced), include a single line “Pot odds: ~XX% (equity needed).” Otherwise omit.

SITUATION
- One-liners: pot type (SRP/3BP), positions, effective stacks, pot and/or SPR if provided, hero cards (if provided).
- BOARD CLASS: name the texture (e.g., low two-tone, paired, monotone, high disconnected). State "Range advantage: X" and "Nuts advantage: X".

RANGE SNAPSHOT
- 1 short line each for Hero and Villain describing typical range after the line taken.

PREFLOP / FLOP / TURN / RIVER
- Sizing family: suggested pot % or bb (give numbers). 
- Value: 3–6 representative hands/classes.
- Bluffs / Semi-bluffs: 3–6 classes.
- Slowdowns / Check-backs: brief line.
- Vs raise: 1 short rule for continue/fold.
- NEXT CARDS (for FLOP and TURN): “Best:” and “Worst:” with 2–4 examples each.

WHY
- 3–6 bullets. Include range- vs nuts-edge, blockers/unblockers, and (if fe_hint provided) fold-equity math “FE ≈ risk/(risk+reward) = <number>%”.

COMMON MISTAKES
- 2–4 bullets that warn about over/under-bluffing, bad sizings, or calling too wide/narrow.

LEARNING TAGS
- 2–4 short tags like ["range-advantage","two-tone-low","spr-5","river-thin-value"].

Rules:
- CASH only; ignore ICM/players-left entirely.
- Be prescriptive, not narrative. Use concise bullets; no markdown headings, no code blocks.
- When info is missing, make reasonable cash-game assumptions (100bb, standard sizes) and proceed.
- Keep the whole "gto_strategy" ~180–260 words (concise but informative).
- If multiple viable lines exist, set "verdict" to the main recommendation and include at least one alternative in "alts" with a rough weight.
`;

/* ----------------------- route handler ----------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards,
      board = "",
      notes = "",
      rawText = "",
      fe_hint,          // optional FE % hint string
      spr_hint          // optional SPR hint
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

    // Compact user block for the model
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)",
      ``,
      // subtle nudge: tell the model to pull the node from the question
      `FOCUS: Identify the street the user is asking about (e.g., "river check — raise or check?") and make the DECISION for that node first, with a numeric size if betting.`
    ].filter(Boolean).join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"],
        verdict: "N/A",
        alts: []
      });
    }

    // call LLM
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
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
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [], verdict: "", alts: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
      verdict: typeof parsed?.verdict === "string" ? parsed.verdict : "",
      alts: Array.isArray(parsed?.alts) ? parsed.alts : []
    };

    // NEW: echo back the model/server's canonical view of hero cards
    const resolved_cards = canonCardsFromRaw(cards, rawText);

    return NextResponse.json({ ...out, resolved_cards });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
