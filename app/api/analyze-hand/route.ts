// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ───────────────────────── helpers ───────────────────────── */

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function detectTournamentHints(s: string): { isMTT: boolean; hits: string[] } {
  const t = (s || "").toLowerCase();
  const hits: string[] = [];
  const terms = [
    "tournament", "mtt", "players left", "icm", "final table", "bubble",
    "pay jump", "payout", "day 1", "day 2", "level ", "ante", "bba"
  ];
  for (const k of terms) if (t.includes(k)) hits.push(k);
  // level-like with ante
  if (/\b\d+\/\d+(?:\/\d+)?\b/.test(t) && /ante|bba/.test(t)) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ───────────────────────── system prompt ───────────────────────── */

const SYSTEM = `You are a CASH-GAME No-Limit Hold'em coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Principles:
- Decide from first principles; DO NOT justify based on what the user *did*. Treat their line as history only.
- If the summary gives hero cards / board, you may infer hand class (air / pair / 2pr / set / straight / flush / combo draw).
- When information is missing, assume 6-max, 100bb, standard sizings.

Write "gto_strategy" as a compact plan (180–260 words) with sections in this order (plain text, no markdown):

DECISION
- Street: Preflop | Flop | Turn | River (pick the street the question targets; if unclear use last street described).
- Action: Call / Fold / Check / Bet / Raise. If betting/raising give a primary SIZE as % pot (and bb if obvious).
- If multiple lines are viable, say "MIXED:" and list 2–3 lines with a rough frequency hint (e.g., "Bet 33% ~60% / Check ~40%") and when each applies.
- Pot odds line only if explicit (else omit).

SITUATION
- SRP/3BP, positions, effective stacks, pot/SPR (if provided), hero hand class.

RANGE SNAPSHOT
- One short line each for Hero and Villain after the line so far.

PREFLOP / FLOP / TURN / RIVER
- Sizing family (numbers).
- Value classes (3–6).
- Bluff/semi-bluff classes (3–6).
- Slowdowns / Check-backs (brief).
- Vs raise: one compact continue/fold rule.
- NEXT CARDS (for Flop/Turn): Best/Worst 2–4 each.

WHY
- 3–6 bullets: range edge, nuts edge, blockers/unblockers, and FE math if the user passed FE hint.

COMMON MISTAKES
- 2–4 bullets.

LEARNING TAGS
- 2–4 short tags like ["range-advantage","two-tone-low","spr-3","thin-value"].

Rules:
- CASH only; ignore ICM and "players left".
- Be prescriptive and concise. No markdown, no code fences.
`;

/* ───────────────────────── route handler ───────────────────────── */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards,        // normalized hero cards, e.g. "K♠ T♥"
      board = "",   // "Flop: ... | Turn: ... | River: ..."
      notes = "",   // free text
      rawText = "", // same as notes, legacy
      fe_hint,      // optional FE %
      spr_hint,     // optional SPR
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

    // Build a compact user block for the model
    const userLines = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Positions: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : "",
      fe_hint ? `FE hint: ${fe_hint}` : "",
      "",
      "RAW HAND TEXT:",
      (rawText || notes || "").trim() || "(none provided)",
      "",
      // Very explicit: ignore what hero did; answer for EV-max
      "FOCUS: Decide the EV-max line NOW (not what hero did). If several lines are close, return a MIXED plan with when/why/size."
    ].filter(Boolean);

    const userBlock = userLines.join("\n");

    // Cash-only guard
    const { isMTT, hits } = detectTournamentHints(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
      });
    }

    // Call model
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content ?? "{}";

    // Robust parsing + [object Object] fix
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If the model ever returns non-JSON, salvage as text
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy ?? ""),
      exploit_deviation: asText(parsed?.exploit_deviation ?? ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
