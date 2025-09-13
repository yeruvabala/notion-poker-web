// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** Simple tournament detector (cash-only beta) */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","left","itm","in the money","final table","bubble",
    "level ","l1","l2","l10","bba","bb ante","ante","day 1","day 2","min-cash","pay jump","payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  // also catch “$xxx MTT” or level formats with ante hints
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Global rules:
- Analyze CASH games only. Ignore any tournament/ICM/bubble/players-left concepts.
- If stacks unknown, assume ~100bb effective.
- Do NOT endorse what the user did; recommend the EV-max line as if advising beforehand.
- Be concrete: actions + sizes (bb or % pot). Keep it crisp, prescriptive, and free of markdown.

Strict output shape for gto_strategy (plain text, these headers MUST appear and in this order):
SITUATION:
PREFLOP:
FLOP:
TURN:
RIVER:
WHY:

Each section should be 1–6 short lines, not paragraphs. Include exact sizes in bb or % pot.

SITUATION:
- Identify pot type (SRP / 3-bet), positions (IP/OOP), effective stack, approximate pot size if apparent, and SPR if possible.
- If numbers are unclear, state approximations (e.g., "SPR ~7").

PREFLOP:
- State open/defend/3-bet/4-bet recommendations with sizes and a quick range skeleton (pairs/broadways/suited Ax/suited connectors).
- If the user is facing an action, choose the GTO-leaning response (e.g., "vs 2.5x CO open, BTN 3-bets ~10bb at some freq; flat with ...").

FLOP:
- Start with Range & Nuts Advantage (who, and why).
- Give a sizing family (e.g., b33/b50/b75/xb high freq) and list examples of value + bluffs for that size.
- Provide a simple vs-raise policy (continue/fold mixes or thresholds).
- Name 2–3 best and worst turn classes to plan ahead.

TURN (Global guardrails; ALWAYS include this section even if the hand ended):
- Card effect bucket: classify the new card as one or more of:
  ["Ace/K/Q high turn","Wheel Ace on low board","Broadway connector (T/J/Q/K)","Straightening card (3-to- or 4-to-a-straight)",
   "Flush adds (3-to-a-suit)","Flush completes (4-to-a-suit)","Paired turn","Low brick"].
  State who the range improvement favors (IP/OOP) and why (nut-density + high-card distribution).
- Sizing family: choose ONE primary family based on range edge + texture:
    Block 20–33%  → thin/protection and modest range edge
    Mid 50–66%    → dynamic turn where pressure is valuable
    Big 75–100%   → polarize with nut-density/EV edge
    Overbet 120–150% → strong nut advantage + capped opponent range
    Check high frequency → when opponent's range improves or we are capped
  Include one sentence justifying the size on this turn.
- Barrel / Slowdown matrix (IP plan first; add OOP note):
    Value barrels: list value classes to bet (e.g., overpairs, top pair good kicker, 2p+, strong combo draws).
    Semi-bluffs: best candidates (BDFD that picked up front-door, GS+FD, overcards with equity).
    Slowdowns: SDV bluff-catchers that dislike a raise, air that didn’t improve.
- Vs raise: Continue with strong value and nutty draws; fold weak pairs/no-equity. Mention x/3bet jam combos at low SPR (≤ ~2.5) if applicable.
- River setup: name 2–4 best and 2–4 worst river classes (flush completes, 4-straight, paired, bricks) and which hands bluff/value/give up.

TURN high-card nudges (position-agnostic):
- If the preflop raiser retains high-card advantage (A/K/Q turns on middling/low flops), maintain pressure with mid-to-big barrels from top pairs+, strong draws, and unblockers. Avoid over-checking.
- If the caller’s range improves materially (wheel A on low paired, straightening low turn that favors caller), reduce bet frequency or size.

RIVER (Global nudges; ALWAYS include this section):
- Classify river card into: ["Flush completes","Flush bricks","4-straight completes","4-straight bricks","Paired river","Unpaired brick","High overcard","Low brick"].
- Value plan and sizing:
    • Polar/nut advantage → big 75–100% or overbet 120–150%.
    • Thin/value-protection on marginal edge → block 20–33%.
    • Give explicit examples of hands that value bet and that check.
- Bluff plan with blockers:
    • Prefer bluffs that block opponent calls (block top pair / missed front-door) and UNBLOCK folds (no spade on missed spade runouts unless it blocks their calls).
    • Name 2–4 specific bluff candidates and 2–4 give-ups.
- Vs raise: be clear—call only with top tier bluff-catchers and fold most thin value. Mention snap folds on over-polar lines where we are capped.
- Close with 1 line: "Best rivers to barrel were …; worst were …" to reinforce planning.

WHY:
- One compact paragraph with: range/nut edge, fold-equity rough math (FE ≈ risk / (risk + reward)), and how blockers/unblockers inform bluffs.
- Keep it instructional and prescriptive.

Formatting notes:
- Plain text only (no markdown). Use the exact headers: SITUATION:, PREFLOP:, FLOP:, TURN:, RIVER:, WHY:
- Use sizes as bb or % pot.`;

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      villainAction = "",
      board = "",
      notes = "",
      rawText = "",
    } = body ?? {};

    // Build a compact user block the model can reason over
    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board: ${board ?? ""}`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)",
    ].join("\n");

    // Cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      const out = {
        gto_strategy:
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `This build analyzes CASH games only. Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
      };
      return NextResponse.json(out);
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
      response_format: { type: "json_object" },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Normalize output
    let gto = asText(parsed?.gto_strategy || "");
    // Light sanity: ensure mandatory headers exist (don’t invent content; just make headers visible if model slipped)
    const need = ["SITUATION:", "PREFLOP:", "FLOP:", "TURN:", "RIVER:", "WHY:"];
    const missingHeaders = need.filter((h) => !new RegExp(`\\b${h}`).test(gto));
    if (missingHeaders.length) {
      gto = `${gto}\n\n${missingHeaders.map((h) => `${h}\n`).join("")}`.trim();
    }

    const out = {
      gto_strategy: gto,
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: any) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
