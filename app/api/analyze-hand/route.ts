// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ------------ light tournament detector (we are cash-only) ------------ */
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

/* ----------- heuristics: detect river IP vs check from story ----------- */
function detectRiverFacingCheck(text: string): boolean {
  const s = (text || "").toLowerCase();
  // If the "river" line mentions a check that is NOT explicitly "hero checks",
  // assume villain checked to us (we are facing a check IP).
  // This is intentionally permissive to fire the hint when likely.
  const riverLineMatch = s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i);
  const riverLine = riverLineMatch ? riverLineMatch[1] : "";
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const saysHeroCheck = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !saysHeroCheck;
}

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

General style:
- Be prescriptive, concise, solver-like.
- Keep "gto_strategy" ~180–260 words.
- Use the section order we’ve been using (DECISION, SITUATION, RANGE SNAPSHOT, PREFLOP/FLOP/TURN/RIVER, WHY, COMMON MISTAKES, LEARNING TAGS).
- When numbers are needed, give pot % (and bb if obvious). Avoid made-up exact equities.

CRITICAL RIVER RULES (to avoid regressions):
- If HINT says ip_river_facing_check=true (i.e., Hero is in position on the river and action checks to Hero), you MUST consider both thin value and pot control.
- Unless the spot is clearly pure (e.g., nutted value vs many worse calls, or obvious give-up), output a MIXED recommendation with frequency split, like:
  "MIXED: Bet small 35–50% ~60% / Check ~40%."
  Then explain when to prefer each: bet vs likely calls by worse, check vs bluff-catchers / scare runouts / capped ranges, etc.
- If it *is* clearly pure, you may give a single action, but state briefly why the alternative is dominated.

DECISION
- Node: Preflop | Flop | Turn | River (choose the node the user is asking about; if unclear, pick the last street described).
- Action: Call / Fold / Check / Bet / Raise OR "MIXED: ..." with frequencies as above.
- Quick reasons: 2–4 bullets.
- If pot odds are explicit (or easily deduced), include “Pot odds: ~XX% (equity needed).” Otherwise omit.

SITUATION
- SRP/3BP, positions, effective stacks, pot/SPR if provided, hero cards (if provided).

RANGE SNAPSHOT
- 1 short line each for Hero and Villain describing typical range after the line taken.

PREFLOP / FLOP / TURN / RIVER
- Sizing family: suggested pot % or bb.
- Value classes: 3–6 examples.
- Bluffs / Semi-bluffs: 3–6 examples.
- Slowdowns / Check-backs: brief line.
- Vs raise: 1 short continue/fold rule.
- NEXT CARDS on FLOP/TURN: “Best:” and “Worst:” with 2–4 examples each.

WHY
- 3–6 bullets: range vs nuts edge, blockers, and (if fe_hint provided) fold-equity math “FE ≈ risk/(risk+reward) = <number>%”.

COMMON MISTAKES
- 2–4 bullets.

LEARNING TAGS
- 2–4 tags like ["thin-value","ip-river-check","spr-5"].

Rules:
- CASH only; ignore ICM/players-left.
- Prefer small sizes for thin value on river when appropriate (25–50%).
- Do NOT narrate what Hero “did”; give the best play(s) **now** given ranges.
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

    // Compact user block for the model with explicit hints
    const ipRiverFacingCheck = detectRiverFacingCheck(rawText || notes || "");

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      ipRiverFacingCheck ? `HINT: ip_river_facing_check=true` : `HINT: ip_river_facing_check=false`,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)",
      ``,
      // Nudge: pick the decision node the user is asking about and respect HINTs
      `FOCUS: Make the DECISION for the street implied by the question (usually the last street described). If ip_river_facing_check=true and the spot is close, give a MIXED plan with small bet frequency + check frequency and when to prefer each.`
    ].filter(Boolean).join("\n");

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
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
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
