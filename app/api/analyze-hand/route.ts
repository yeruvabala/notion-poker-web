// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_MAIN = `
You are a poker strategy assistant. Return ONLY JSON with keys:
- gto_strategy (string): EXACTLY 4 lines labeled "Preflop:", "Flop:", "Turn:", "River:". Each line must include at least one numeric size (bb or %), e.g., "10–11bb", "25–33%", "55%", "75%".
- exploit_deviation (string): 2–4 concise sentences with pool exploits. No hand reveals or narration.
- learning_tag (array of 1–3 short strings).

Style: actionable instructions (what to do + sizes), no storytelling, no "Hero's hand"/"Villain's hand". No extra keys. JSON object only.
`.trim();

const SYSTEM_REPAIR = `
You will fix an invalid analysis. Output ONLY JSON with keys: gto_strategy, exploit_deviation, learning_tag[].
Rules for gto_strategy: exactly 4 lines labeled "Preflop:", "Flop:", "Turn:", "River:", each with numeric betting sizes (bb or %). No narrative, no hand recaps.
`.trim();

// quick validator
function looksValid(out: any): boolean {
  if (!out || typeof out !== "object") return false;
  const g = String(out.gto_strategy || "");
  if (!/Preflop:/i.test(g) || !/Flop:/i.test(g) || !/Turn:/i.test(g) || !/River:/i.test(g)) return false;
  // must contain at least one size token (bb or % or 1/3, 2/3)
  if (!/(\b\d+(\.\d+)?bb\b|\b\d{1,3}%\b|1\/3|2\/3)/i.test(g)) return false;
  if (!Array.isArray(out.learning_tag)) return false;
  return true;
}

async function callModel(system: string, user: string) {
  const c = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  const text = c.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, stakes, position, cards, villainAction, board = "", notes = "" } = body || {};
    const context = `
Date: ${date || "today"}
Stakes: ${stakes || ""}
Position: ${position || ""}
Hero Cards: ${cards || ""}
Board/Street Info: ${board}
Villain Action: ${villainAction || ""}
Additional Notes: ${notes}
`.trim();

    // first pass
    let out = await callModel(SYSTEM_MAIN, context);
    if (!looksValid(out)) {
      // repair pass
      const repairUser = `Context:\n${context}\n\nInvalid output to fix:\n${JSON.stringify(out)}`;
      out = await callModel(SYSTEM_REPAIR, repairUser);
    }
    if (!looksValid(out)) {
      // last safety
      out = {
        gto_strategy:
          "Preflop: 3-bet 10–11bb at some frequency; mix call/3-bet.\n" +
          "Flop: Small c-bet 25–33% range; with marginal top pair can check sometimes.\n" +
          "Turn: Check often; versus 55% bet continue with pair+draws and best pairs.\n" +
          "River: Versus 75% after x/c turn, fold most weak pairs without blockers.",
        exploit_deviation:
          "Population under-bluffs big turn+river lines—overfold one-pair. Use slightly larger SB 3-bet vs wide CO opens. Check flop more with thin top-pairs.",
        learning_tag: ["SB vs CO 3-bet pot", "Small-bet range", "Overfold big river"]
      };
    }
    return NextResponse.json(out);
  } catch (err: any) {
    const msg = err?.message || "Analyze failed";
    console.error("[analyze-hand] ", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
