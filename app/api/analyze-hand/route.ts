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
Stakes: ${String(stakes)}
Position: ${position}
Hero Cards: ${cards}
Board/Street Info: ${board}
Villain Action: ${villainAction}
Additional Notes: ${notes}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a poker strategy assistant. Given a parsed hand, return: (1) concise GTO line with bet sizes; (2) clear exploit deviations by pool tendency; (3) 1–3 learning tags. Keep it practical and specific.",
        },
        {
          role: "user",
          content:
            userBlock +
            `
Return JSON with EXACT keys: 
{
  "gto_strategy": "...",
  "exploit_deviation": "...",
  "learning_tag": ["Tag1", "Tag2"]
}`,
        },
      ],
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "";

    let out = { gto_strategy: "", exploit_deviation: "", learning_tag: [] as string[] };
    try {
      out = JSON.parse(text);
    } catch {
      out.gto_strategy = text; // fallback if JSON parse fails
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to analyze hand" }, { status: 500 });
  }
}
