import { NextResponse } from "next/server";
import { openai } from "../../lib/openai"; // relative path

const SYSTEM = `You are a poker study parser. Extract concise fields from the user's free text.
Return STRICT JSON with keys: date (YYYY-MM-DD), stakes (number), position (UTG|MP|CO|BTN|SB|BB), cards,
villain_action, gto_strategy, exploit_deviation, learning_tag (array of strings). If unknown, use null or []`;

export async function POST(req: Request) {
  const { input } = await req.json();
  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const user = `Text: ${input}\nToday: ${today}\nRules: If date missing, use Today. Stakes should be numeric only (no $).`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user }
    ],
    response_format: { type: "json_object" }
  });

  const json = JSON.parse(resp.choices[0].message.content || "{}");
  return NextResponse.json(json);
}
