// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM = `You are a poker strategy assistant. Always recommend the best line; do not justify a user's suboptimal action.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string"]
}

Guidelines:
- Tailor to mode: CASH vs MTT. If MTT and icm_context=true (bubble/FT etc.), use ICM-aware adjustments (tighter calls, more fold pre, jam/fold trees at 12–20bb).
- Use the provided eff_bb and blinds if present.
- gto_strategy: compact, street-by-street (Preflop / Flop / Turn / River) with sizes (bb or % pot) and brief reasons.
- exploit_deviation: 2–4 concise sentences about pool tendencies and deviations (e.g., overfolding to large river bets, under-3bet from blinds, etc.).
- learning_tag: 1–3 short tags like "SB vs CO 3-bet pot", "ICM bubble", "Small-bet low boards".
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
    const { date, stakes, position, cards, villainAction = "", board = "", notes = "", mode = "", eff_bb = null, blinds = "", icm_context = false } = body ?? {};

    const userBlock = [
      `Mode: ${mode || "unknown"}`,
      `ICM context: ${icm_context ? "true" : "false"}`,
      `Effective stack (bb): ${eff_bb ?? "unknown"}`,
      `Blinds: ${blinds || stakes || "unknown"}`,
      `Position: ${position || ""}`,
      `Hero Cards: ${cards || ""}`,
      `Board: ${board || ""}`,
      `Villain Action: ${villainAction || ""}`,
      `Notes: ${notes || ""}`,
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
