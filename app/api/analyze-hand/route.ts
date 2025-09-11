// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * Coach prompt:
 * - Strict JSON
 * - SUITS RULE: Preflop-only → suits aren't required (A4s/A4 suited vs A4o).
 * - Postflop → suits can matter; if ambiguous, note briefly and proceed.
 */
const SYSTEM = `You are a tough, no-nonsense poker coach.
Return ONLY strict JSON with EXACT keys:

{
  "verdict": {
    "label": "Correct" | "Mistake" | "Marginal",
    "summary": "one plain sentence explaining the judgement",
    "reasons": ["bullet", "bullet"]
  },
  "recommended_line": "one-line recommendation (e.g., 'Fold pre', '4-bet jam 18bb', 'Flat and play postflop')",
  "gto_strategy": "compact Preflop/Flop/Turn/River plan with sizes in bb or % pot. Put Preflop first, use exact numbers where possible.",
  "exploit_deviation": "2–4 concise sentences about pool tendencies & how to deviate.",
  "learning_tag": ["short tag", "optional second tag"]
}

Judging rules:
- Do NOT endorse a play just because the user took it; judge as if advising beforehand.
- Use context (cash vs tournament, ICM/bubble mentions, effective stacks, positions, raise sizes).
- Include quick math in reasons: risk, reward, FE threshold ~= risk/(risk+reward), and a short equity/range note.
- If bubble/ICM is present, tighten stack-off thresholds and say so explicitly.

SUITS RULE (IMPORTANT):
- If the user's input is PRE-FLOP ONLY (no flop/turn/river/board given), treat 'A4 suited' or 'A4s' as suited, and 'A4o'/'offsuit' as offsuit. Do NOT ask for exact suits; they are irrelevant preflop.
- If any POSTFLOP info exists, suits may matter. If suits are ambiguous there, briefly note the ambiguity and proceed with a reasonable assumption.

Keep everything concise, factual, and prescriptive. No markdown. Strict JSON only.`;

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
      rawText = ""
    } = body ?? {};

    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board: ${board ?? ""}`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)"
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
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
      parsed = {
        verdict: { label: "Marginal", summary: raw.slice(0, 160), reasons: [] },
        recommended_line: "",
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: []
      };
    }

    const out = {
      verdict: {
        label: parsed?.verdict?.label || "Marginal",
        summary: asText(parsed?.verdict?.summary || ""),
        reasons: Array.isArray(parsed?.verdict?.reasons)
          ? parsed.verdict.reasons.filter((t: unknown) => typeof t === "string" && (t as string).trim())
          : [],
      },
      recommended_line: asText(parsed?.recommended_line || ""),
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && (t as string).trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
