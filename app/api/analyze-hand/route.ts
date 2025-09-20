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

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY. 
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Write "gto_strategy" as a compact, structured coaching plan with these sections IN THIS ORDER:

DECISION
- Node: Preflop | Flop | Turn | River (choose the node the user is asking about; if unclear, use the last street described in the raw text).
- Action: one of Call / Fold / Check / Bet / Raise. If betting/raising, give a primary SIZE as % pot (and bb if obvious) and, if appropriate, a secondary acceptable size.
- MIXED: If multiple lines are viable, say "MIXED:" and list them with rough frequencies, e.g., "Bet 50% ~60% (for value) / Check-back ~40% (showdown/pot control)". Use "check-back" when the action closes with Hero.
- Pot odds: include a single line “Pot odds: ~XX% (equity needed)” only if pot odds are explicit or easy to deduce.

SITUATION
- One-liners: pot type (SRP/3BP), positions, effective stacks, pot and/or SPR if provided, hero cards (if provided).

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

Critical rules:
- CASH only; ignore ICM/players-left entirely.
- Position & action-closure rule:
  * If Hero is in-position on the RIVER and Villain checks to Hero, any "Check" by Hero is a check-back to showdown. Do NOT say "induce bluffs" there. Use reasons like "showdown value / pot control / thin-value not mandatory".
  * Only use "induce bluffs" for checks that leave future betting options for Villain (earlier streets or when Hero is out of position).
- Be prescriptive, not narrative. Use concise bullets; no markdown headings, no code blocks.
- When info is missing, make reasonable cash-game assumptions (100bb, standard sizes) and proceed.
- Keep the whole "gto_strategy" ~180–260 words (concise but informative).
- "exploit_deviation" should be 2–4 bullets of pool exploits relevant to the spot.
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
      // Nudge to anchor on the right node and avoid "induce" when last to act
      `FOCUS: Choose the most relevant node (often the last street described). If Villain checked to an in-position Hero on the river, a Hero check is a check-back (no "induce bluffs").`
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
