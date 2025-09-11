// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * Street-aware, solver-like analyzer that outputs strict JSON and is not biased
 * by the user's own line.
 *
 * JSON shape returned to the UI:
 * {
 *   "recommended_line": string,         // one short directive for the next action
 *   "gto_strategy": string,             // street-by-street plan + "Why:" bullets
 *   "exploit_deviation": string,        // 2–4 short sentences
 *   "learning_tag": string[],           // 0–3 short tags
 *   "needs": string[]                   // optional: what details would improve accuracy (e.g., exact suits postflop)
 * }
 */

const BASE_SYSTEM = `You are a precise poker coach producing solver-like advice.
Return ONLY strict JSON with EXACT keys:

{
  "recommended_line": "short next action (e.g., 'Open 2.2bb', '3-bet 7.5bb', 'Jam preflop', 'Call flop, fold to big turn bet')",
  "gto_strategy": "Street-by-street plan with sizes. Include only the streets indicated by StreetMask. After the plan add 'Why:' with 2–5 bullets (fold-equity math, equity when called, texture/position/SPR logic).",
  "exploit_deviation": "2–4 short sentences on common pool leaks & how to deviate.",
  "learning_tag": ["optional short tag", "optional tag 2"],
  "needs": ["optional list of missing details that would improve accuracy"]
}

Rules:
- BE STREET-AWARE: If only Preflop is relevant, give Preflop only. If flop is present, include Flop. If turn present, include Turn. If river present, include River.
- DO NOT mirror or endorse the user's own line. Judge independently.
- Prefer crisp, prescriptive sizes (bb or % pot). Avoid rambling.
- Math: include a quick FE threshold ~= risk/(risk+reward) when shoves/raises are considered; mention approximate equity when called if relevant.
- Preflop-only: suits do NOT matter. Do not request suits in 'needs' if only preflop is relevant.
- Postflop: suits and board texture DO matter. If suits are unclear, put a short note in 'needs' (e.g., "Exact suits for Hero and/or board").
- Tournament & ICM: If the text implies bubble/ICM/ladder, adjust thresholds (tighter stack-offs) and say so in 'Why:'.
- Use compact English. No markdown, no extra keys, no code, strict JSON only.`;

/** ------------ small helpers ------------ */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  return String(v);
}

type StreetMask = { preflop: boolean; flop: boolean; turn: boolean; river: boolean };

function detectStreetMask(boardStr?: string): StreetMask {
  const s = (boardStr || "").trim();
  if (!s) return { preflop: true, flop: false, turn: false, river: false };
  const hasFlop = /flop/i.test(s) || s.split(/\s+/).filter(Boolean).length >= 3;
  const hasTurn = /turn/i.test(s) || s.split(/\s+/).filter(Boolean).length >= 4;
  const hasRiver = /river/i.test(s) || s.split(/\s+/).filter(Boolean).length >= 5;
  return { preflop: true, flop: !!hasFlop, turn: !!hasTurn, river: !!hasRiver };
}

function detectMode(raw: string) {
  const t = (raw || "").toLowerCase();
  const tourney =
    /\b(mtt|tournament|icm|bubble|final table|ft|itm|in the money|ladder|payout)\b/.test(
      t
    );
  return tourney ? "Tournament" : "Cash";
}

function suitsAreAmbiguous(mask: StreetMask, board: string, cards: string) {
  if (!mask.flop && !mask.turn && !mask.river) return false; // preflop-only
  const hasSuitChar = /[♥♦♣♠]/.test(board) || /[♥♦♣♠]/.test(cards);
  // Also accept letter-suits like "As Qs" etc.
  const hasLetterSuit = /\b[2-9TJQKA][shdc]\b/i.test(board) || /\b[2-9TJQKA][shdc]\b/i.test(cards);
  return !(hasSuitChar || hasLetterSuit);
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

    const mask = detectStreetMask(board);
    const mode = detectMode(rawText || notes || "");
    const needSuits = suitsAreAmbiguous(mask, board || "", cards || "");

    // Build a compact user block with a StreetMask directive so the model only outputs needed streets.
    const userBlock = [
      `Date: ${date || "today"}`,
      `Mode: ${mode}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board: ${board ?? ""}`,
      `Villain Action: ${villainAction ?? ""}`,
      `StreetMask: Preflop=${mask.preflop ? "true" : "false"}, Flop=${mask.flop ? "true" : "false"}, Turn=${mask.turn ? "true" : "false"}, River=${mask.river ? "true" : "false"}`,
      "",
      "Raw hand text (for context, do not mirror user's line):",
      (rawText || notes || "").trim() || "(none provided)",
    ].join("\n");

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: BASE_SYSTEM },
      { role: "user", content: userBlock },
    ];

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages,
      response_format: { type: "json_object" },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        recommended_line: "",
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: [],
        needs: [],
      };
    }

    // Normalize & fortify output
    let recommended = asText(parsed?.recommended_line || "");
    let gto = asText(parsed?.gto_strategy || "");
    const deviation = asText(parsed?.exploit_deviation || "");
    const tags: string[] = Array.isArray(parsed?.learning_tag)
      ? parsed.learning_tag.filter((t: any) => typeof t === "string" && t.trim())
      : [];
    const needs: string[] = Array.isArray(parsed?.needs)
      ? parsed.needs.filter((t: any) => typeof t === "string" && t.trim())
      : [];

    // Ensure a Why: block exists with at least a couple bullets
    const hasWhy = /\n\s*Why\b\s*:/i.test(gto);
    if (!hasWhy) {
      const fallbackBullets: string[] = [
        "Fold-equity threshold ≈ risk/(risk+reward).",
        "Equity when called estimated from typical ranges.",
        "Position/SPR/texture considerations drive sizing.",
      ];
      const bullets = fallbackBullets.map((r: string) => `• ${r}`).join("\n");
      gto = `${gto}\n\nWhy:\n${bullets}`.trim();
    }

    // Add suit request if postflop context exists but suits are ambiguous
    if (needSuits) {
      needs.push("Exact suits for Hero and/or board (postflop accuracy)");
    }

    return NextResponse.json({
      recommended_line: recommended,
      gto_strategy: gto,
      exploit_deviation: deviation,
      learning_tag: tags,
      needs,
    });
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
