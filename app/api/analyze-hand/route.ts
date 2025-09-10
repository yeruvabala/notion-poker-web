// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * Coach prompt: judge the line, give prescriptive GTO plan,
 * and ALWAYS include numeric reasoning.
 */
const SYSTEM = `You are a tough poker coach. Return STRICT JSON with EXACT keys:

{
  "verdict": {
    "label": "Correct" | "Mistake" | "Marginal",
    "summary": "one plain sentence judging Hero's FINAL key decision",
    "reasons": ["2–5 short bullets with quick math and logic"]
  },
  "recommended_line": "one-line command for the best action (e.g., 'Fold pre', 'Call 20bb shove', 'Jam 18bb over raise')",
  "gto_strategy": "120–220 words. Start with a single line: 'Decision: <Fold|Call|Jam> <hand> <spot>'. Then give a STREET-BY-STREET plan (sizes in bb or % pot). Finish with a 'Why' section containing numeric reasoning: risk, reward, fold-equity threshold ~= risk/(risk+reward), an equity estimate vs a plausible range, key blockers/coverage, and ICM note when it's a tournament.",
  "exploit_deviation": "2–4 concise sentences about common pool leaks here and how to deviate.",
  "learning_tag": ["short tag", "optional second tag"]
}

Rules:
- DO NOT endorse a play just because the user did it; judge it as if coaching beforehand.
- Parse context (cash vs tournament, ICM/bubble clues, effective stacks, antes, positions, sizes) from the text.
- Numbers don't need to be exact, but include a sensible ballpark for fold-equity threshold and equity.
- No markdown; plain text only; JSON object only.`;

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

    // Pack everything the model might need in one user message.
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
        { role: "user", content: userBlock }
      ],
      response_format: { type: "json_object" }
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

    // Normalize + enrich
    const verdict = {
      label: parsed?.verdict?.label || "Marginal",
      summary: asText(parsed?.verdict?.summary || ""),
      reasons: Array.isArray(parsed?.verdict?.reasons)
        ? parsed.verdict.reasons.filter((t: any) => typeof t === "string" && t.trim())
        : []
    };

    // Ensure the GTO box ALWAYS has a decision line and a WHY section with bullets.
    let gto = asText(parsed?.gto_strategy || "").trim();
    const rec = asText(parsed?.recommended_line || "").trim();

    // 1) Inject a "Decision:" line at the very top if missing.
    const hasDecisionLine = /^Decision:/i.test(gto);
    const decisionLine =
      rec
        ? `Decision: ${rec}.`
        : (verdict.summary ? `Decision: ${verdict.summary}` : "");
    if (decisionLine && !hasDecisionLine) {
      gto = (gto ? `${decisionLine}\n${gto}` : decisionLine).trim();
    }

    // 2) Append a "Why" section with numeric bullets if missing.
    const hasWhy = /\n\s*Why\b/i.test(gto);
    if (verdict.reasons.length && !hasWhy) {
      const bullets = verdict.reasons.map((r) => `• ${r}`).join("\n");
      gto = `${gto}\n\nWhy:\n${bullets}`.trim();
    }

    const out = {
      verdict,
      recommended_line: rec,
      gto_strategy: gto,
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: any) => typeof t === "string" && t.trim())
        : []
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
