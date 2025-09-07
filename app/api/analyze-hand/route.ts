// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY (set it in .env.local or Vercel → Settings → Environment Variables)" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    const system = `
You are a poker strategy assistant.

Return STRICT JSON with keys:
- gto_strategy (string, <=120 words): concrete bet lines + sizes for Preflop, Flop, Turn, River.
- exploit_deviation (string, <=60 words): 2–4 concise sentences about pool exploits, practical and specific.
- learning_tag (array of 1–4 short strings): choose ONLY from this fixed set:
["Cooler","Bad beat","Suckout","Resuck","Flip","Dominated","Freeroll","Drawing dead","Chop",
 "Set over set","Straight over straight","Flush over flush","Boat over boat","Runner-runner",
 "Counterfeited","Reverse implied odds","Overfold big river","Small-bet low boards",
 "SB vs CO 3-bet pot","CO vs BTN 3-bet pot","BB vs SB 4-bet pot","Action-killer river"]

Rules:
- No markdown, no extra keys, no preamble.
- Keep sizes explicit (e.g., 10–11bb, 25–33%, 55%, 75%).
- Focus on what to do, not narrating hole cards.
`.trim();

    const userBlock = `
Date: ${date || "today"}
Stakes: ${String(stakes || "")}
Position: ${position || ""}
Hero Cards: ${cards || ""}
Board/Street Info: ${board}
Villain Action: ${villainAction || ""}
Additional Notes: ${notes}
`.trim();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userBlock },
        {
          role: "user",
          content:
            `Return JSON with exactly:\n` +
            `{ "gto_strategy": "...", "exploit_deviation": "...", "learning_tag": ["Tag1","Tag2"] }`,
        },
      ],
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "{}";

    // Robust JSON parse (with fallback extraction)
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const out = {
      gto_strategy: parsed?.gto_strategy || "",
      exploit_deviation: parsed?.exploit_deviation || "",
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag
        : parsed?.learning_tag
        ? [String(parsed.learning_tag)]
        : [],
    };

    return NextResponse.json(out);
  } catch (err: any) {
    // Surface the real reason, not a generic message
    const msg =
      err?.error?.message ||
      err?.response?.data?.error?.message ||
      err?.message ||
      "Analyze error";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
