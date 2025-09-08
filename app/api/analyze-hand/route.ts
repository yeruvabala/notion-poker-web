// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Coerce any value (string | array | object) into a readable multiline string.
 * - Objects become "Key: value" lines (Preflop/Flop/Turn/River headers preserved)
 * - Arrays join with new lines
 * - Null/undefined -> ""
 */
function toMultilineText(v: any): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v.map(toMultilineText).filter(Boolean).join("\n");
  }
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([k, val]) => {
        const key = String(k).trim();
        const header = /^(preflop|flop|turn|river)$/i.test(key)
          ? `${key[0].toUpperCase()}${key.slice(1)}`
          : key;
        return `${header}: ${toMultilineText(val)}`.trim();
      })
      .join("\n");
  }
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
      villainAction,
      board = "",
      notes = "",
    } = body || {};

    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board / Streets: ${board}`,
      `Villain Action: ${villainAction ?? ""}`,
      `Notes: ${notes}`,
    ].join("\n");

    // Ask the model for STRICT JSON only (no prose)
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            [
              "You are a poker strategy assistant. Return ONLY JSON (no markdown).",
              "Keys:",
              '- "gto_strategy": can be a single string OR an object with keys {Preflop, Flop, Turn, River}. Keep it concise but specific (bet sizes & actions).',
              '- "exploit_deviation": string or array; concise pool exploits.',
              '- "learning_tag": array of 1–3 short strings (e.g., ["SB vs CO 3-bet", "Small-bet low boards"]).',
              "Do not include extra keys. No markdown. JSON object only.",
            ].join(" "),
        },
        {
          role: "user",
          content: userBlock,
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content?.trim() || "";

    // Default output shape
    let out: {
      gto_strategy: any;
      exploit_deviation: any;
      learning_tag: string[] | string;
    } = { gto_strategy: "", exploit_deviation: "", learning_tag: [] };

    // Try to parse JSON; if we only got text, put it in gto_strategy
    try {
      out = JSON.parse(raw);
    } catch {
      out.gto_strategy = raw;
    }

    // ---- Normalize everything to strings/arrays ----
    // learning_tag → string[]
    const tags =
      Array.isArray(out.learning_tag)
        ? out.learning_tag
        : typeof out.learning_tag === "string"
          ? out.learning_tag.split(",")
          : [];

    const learning_tag = tags.map(String).map(s => s.trim()).filter(Boolean).slice(0, 3);

    // Coerce gto_strategy & exploit_deviation to multiline text
    const gto_strategy = toMultilineText(out.gto_strategy);
    const exploit_deviation = toMultilineText(out.exploit_deviation);

    return NextResponse.json({
      gto_strategy,
      exploit_deviation,
      learning_tag,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to analyze hand" },
      { status: 500 }
    );
  }
}
