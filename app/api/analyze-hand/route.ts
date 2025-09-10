// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM = `You are a poker strategy assistant.
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}
Rules (strict):
- Use ONLY the explicit fields provided below (Position, HeroCards, EffectiveStackBB, Mode, Stakes, Board, VillainAction, Notes).
- Do NOT infer Hero's effective stack from any other numbers in Notes (e.g., don't use "one short 6bb" as hero's stack). If EffectiveStackBB is null, say "Effective stack unknown" and give generic size guidance.
- Respect Position exactly; never change it.
- Start gto_strategy with a header like: "Preflop (POSITION, Xbb eff): …".
- Give a compact but specific Preflop/Flop/Turn/River plan with sizes (bb or % pot). If streets are unknown, include only known streets.
- Make exploit_deviation 2–4 concise sentences about pool tendencies and how to deviate.
- learning_tag = 1–3 short tags (e.g., "HJ vs UTG open", "ICM bubble", "Short-stack defense").
- No markdown or extra keys. JSON object only.`;

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
      effectiveBB = null,
      mode = "",
    } = body ?? {};

    const userBlock = [
      `Mode: ${mode || "unknown"}`,
      `Position: ${position || "unknown"}`,
      `HeroCards: ${cards || "unknown"}`,
      `EffectiveStackBB: ${effectiveBB === null ? "unknown" : String(effectiveBB)}`,
      `Stakes: ${stakes ?? ""}`,
      `Board: ${board ?? ""}`,
      `VillainAction: ${villainAction ?? ""}`,
      `Notes: ${notes ?? ""}`,
      `Date: ${date || "today"}`,
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
      response_format: { type: "json_object" },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch { parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] }; }

    const out = {
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
