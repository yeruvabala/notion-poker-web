// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const userBlock = `
Date: ${date || "today"}
Stakes: ${String(stakes || "")}
Position: ${position || ""}
Hero Cards: ${cards || ""}
Board/Street Info: ${board}
Villain Action: ${villainAction || ""}
Additional Notes: ${notes}
`;

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

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: userBlock,
        },
        {
          role: "user",
          content: `Return JSON with exactly:
{ "gto_strategy": "...", "exploit_deviation": "...", "learning_tag": ["Tag1","Tag2"] }`,
        },
      ],
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "";
    let out = { gto_strategy: "", exploit_deviation: "", learning_tag: [] as string[] };

    try {
      out = JSON.parse(text);
    } catch {
      out.gto_strategy = text; // fallback if JSON parsing fails
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to analyze hand" }, { status: 500 });
  }
}
