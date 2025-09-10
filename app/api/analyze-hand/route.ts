// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM = `You are a tough, no-nonsense poker coach.
Return ONLY strict JSON with EXACT keys:

{
  "hero_action_found": true | false,
  "hero_action": "string | null",
  "verdict": null | {
    "label": "Correct" | "Mistake" | "Marginal",
    "summary": "one plain sentence explaining the judgement",
    "reasons": ["bullet", "bullet"]
  },
  "recommended_line": "one-line recommendation (e.g., 'Fold pre', '4-bet jam 18bb')",
  "gto_strategy": "compact Preflop/Flop/Turn/River plan with exact sizes (bb or % pot)",
  "exploit_deviation": "2–4 concise sentences about pool tendencies & deviations",
  "learning_tag": ["short tag", "optional second tag"]
}

Rules:
- FIRST, decide if the user's text **explicitly** states Hero's final action (e.g., "I called", "I jam", "hero folds", "we c-bet 2bb"). 
  If not explicit, set "hero_action_found": false, "hero_action": null, and **set "verdict": null**.
- Only produce a Mistake/Correct/Marginal verdict when "hero_action_found" is true (an explicit hero decision is present).
- Always fill "gto_strategy" with a clear plan (preflop first; include %pot or bb). If some streets are unknown, include only known streets.
- Use the provided fields exactly (Position, HeroCards, EffectiveStack if present, Stakes, Board, VillainAction, Notes/Raw text). 
  Do NOT infer Hero's stack from other players' stacks.
- Include quick math in reasons when giving a verdict: risk, reward, FE threshold ~= risk/(risk+reward), simple equity intuition.
- Keep language concise and prescriptive. No markdown. Strict JSON only.`;

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
      effectiveBB = null,
      mode = ""
    } = body ?? {};

    const userBlock = [
      `Mode: ${mode || "unknown"}`,
      `Position: ${position || "unknown"}`,
      `HeroCards: ${cards || "unknown"}`,
      `EffectiveStackBB: ${effectiveBB === null ? "unknown" : String(effectiveBB)}`,
      `Stakes: ${stakes ?? ""}`,
      `Board: ${board ?? ""}`,
      `VillainAction: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)",
      "",
      "Instruction: Only judge a Mistake/Correct if my final action is explicitly present. Otherwise verdict must be null."
    ].join("\n");

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
    try { parsed = JSON.parse(raw); }
    catch {
      parsed = {
        hero_action_found: false,
        hero_action: null,
        verdict: null,
        recommended_line: "",
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: []
      };
    }

    const out = {
      hero_action_found: !!parsed?.hero_action_found,
      hero_action: typeof parsed?.hero_action === "string" ? parsed.hero_action : null,
      verdict: parsed?.verdict && typeof parsed.verdict === "object"
        ? {
            label: parsed.verdict.label || "Marginal",
            summary: asText(parsed.verdict.summary || ""),
            reasons: Array.isArray(parsed.verdict.reasons)
              ? parsed.verdict.reasons.filter((t: any) => typeof t === "string" && t.trim())
              : [],
          }
        : null,
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
