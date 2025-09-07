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
`.trim();

    const completion = await openai.chat.completions.create({
      // Use a model you already use successfully in /api/parse
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a poker strategy assistant. Return only JSON with: gto_strategy (string), exploit_deviation (string), learning_tag (array of 1–3 strings). Be concise and specific."
        },
        {
          role: "user",
          content: userBlock
        }
      ],
      // force a valid JSON object back
      response_format: { type: "json_object" }
    });

    const text = completion?.choices?.[0]?.message?.content ?? "{}";
    const out = JSON.parse(text); // will be { gto_strategy, exploit_deviation, learning_tag }
    return NextResponse.json(out);
  } catch (err: any) {
    // bubble up the real cause so the UI shows it
    const msg =
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "Analyze failed";
    console.error("[analyze-hand] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
