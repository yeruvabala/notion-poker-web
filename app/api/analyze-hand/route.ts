 


// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * The model must JUDGE the hero's final key decision.
 * It should not endorse a line just because the user took it.
 * We require a strict JSON shape with a verdict + recommended line.
 */
const SYSTEM = `You are a tough, no-nonsense poker coach.
Return ONLY strict JSON with EXACT keys:

{
  "verdict": {            // explicit judgement of hero's key decision
    "label": "Correct" | "Mistake" | "Marginal",
    "summary": "one plain sentence explaining the judgement",
    "reasons": ["bullet", "bullet"]   // 2–5 short bullets with quick math
  },
  "recommended_line": "one-line recommendation for what Hero should do instead (e.g., 'Fold pre', '4-bet jam 18bb', 'Flat and play postflop')",
  "gto_strategy": "compact Preflop/Flop/Turn/River plan with sizes (bb or % pot). Put Preflop first, include exact numbers where possible.",
  "exploit_deviation": "2–4 concise sentences about pool tendencies & how to deviate.",
  "learning_tag": ["short tag", "optional second tag"]
}

Judging rules:
- Never justify a play just because the user did it; evaluate it as if coaching beforehand.
- Use context (cash vs tournament, ICM/bubble mentions, effective stacks, positions, raise sizes).
- Include quick math in reasons: risk, reward, fold-equity threshold ~= risk/(risk+reward), and a one-line equity or range note.
- If tournament bubble/ICM is present, tighten stack-off thresholds and say so explicitly.
- Keep everything concise, factual, and prescriptive. No markdown. Strict JSON only.`;

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
    // We accept whatever the client can pass. Include rawText when available.
    const {
      date,
      stakes,
      position,
      cards,
      villainAction = "",
      board = "",
      notes = "",          // may contain the full narrative if client forwards it
      rawText = ""         // optional: explicit raw hand text (preferred)
    } = body ?? {};

    // Build a single user block that contains everything we know.
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
      // If the model ever slips, salvage what we can.
      parsed = {
        verdict: { label: "Marginal", summary: raw.slice(0, 160), reasons: [] },
        recommended_line: "",
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: []
      };
    }

    // Normalize minimal shape
    const out = {
      verdict: {
        label: parsed?.verdict?.label || "Marginal",
        summary: asText(parsed?.verdict?.summary || ""),
        reasons: Array.isArray(parsed?.verdict?.reasons)
          ? parsed.verdict.reasons.filter((t: any) => typeof t === "string" && t.trim())
          : [],
      },
      recommended_line: asText(parsed?.recommended_line || ""),
      gto_strategy: asText(parsed?.gto_strategy || ""),
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
