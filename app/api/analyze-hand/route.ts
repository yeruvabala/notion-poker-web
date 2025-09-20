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

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Write "gto_strategy" as a compact coaching plan (180–260 words) with these sections IN THIS ORDER:

DECISION
- Node: Preflop | Flop | Turn | River.
- Action: Check / Call / Fold / Bet / Raise. If betting/raising, give a primary SIZE as % pot and optionally a secondary.
- If the user supplied an action_hint (e.g., "RIVER: facing-bet ~75%"), incorporate it when picking a decision.

SITUATION
- One-liners: pot type (SRP/3BP), positions, eff stacks, pot/SPR if provided, HERO HAND CLASS (use the provided hand_class literal), board summary.

RANGE SNAPSHOT
- 1 short line each for Hero and Villain ranges after the line taken.

PREFLOP / FLOP / TURN / RIVER
- Sizing family (numbers).
- Value classes (3–6).
- Bluffs / Semi-bluffs (3–6).
- Slowdowns / Check-backs (brief).
- Vs raise: single rule for continue/fold.
- NEXT CARDS (for Flop and Turn): Best: …, Worst: …

WHY
- 3–6 bullets. Use blockers/unblockers/fold-equity math if fe_hint present.

COMMON MISTAKES
- 2–4 bullets about over/under-bluffing, bad sizings, calling too wide/narrow.

Rules:
- CASH only; ignore ICM/players-left entirely.
- Treat "hand_class" and "action_hint" from the user as FACTS; do NOT contradict them.
- Be prescriptive, concise; no markdown headings/code blocks.
`;

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
      spr_hint,
      action_hint = "",
      hand_class = "Unknown",
      source_used = "STORY"
    } = body ?? {};

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      `HERO HAND CLASS: ${hand_class}`,
      action_hint ? `ACTION HINT: ${action_hint}` : ``,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `SOURCE USED: ${source_used}`,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)"
    ].filter(Boolean).join("\n");

    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"]
      });
    }

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
    try { parsed = JSON.parse(raw); }
    catch { parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] }; }

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
