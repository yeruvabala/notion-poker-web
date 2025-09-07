// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Strong, reusable system prompt that forces a detailed plan ---
const SYSTEM = `
You are a poker strategy assistant. Return ONLY JSON.

JSON OBJECT MUST HAVE EXACT KEYS:
- gto_strategy (string)
- exploit_deviation (string)
- learning_tag (array of 1–3 short strings)

Write gto_strategy as a DETAILED street-by-street checklist for THIS EXACT HAND.
Use concise bullet sentences, and ALWAYS include specific sizes and reactions.

REQUIRED gto_strategy TEMPLATE (fill with the user's hand info):
Preflop: (villain position, hero position, stack depth)
- 3-bet size (in bb) and frequency for THIS combo
- Vs 4-bet (25–30bb typical): exact response for THIS combo at this depth (fold / 5-bet bluff % / call)

Flop: (board spelled out, say who is OOP/IP)
- Range plan (check/c-bet mix; give % if useful)
- With THIS combo (name it implicitly): preferred action
  - If face 25–33% bet: action
  - If face 50–60% bet: action
  - If face ≥75% bet: action
  - If you c-bet 25–33% and face ~3x raise: action

Turn: (card spelled out; note equity/interaction)
- Range plan (who increases EV, who slows)
- With THIS combo:
  - If face 40–60%: action
  - If face 75%+: action
  - If checked through: when to stab and size

River: (card spelled out; note if improves/neutral/bricks)
- Default action for THIS combo
- Vs 25–40%: action
- Vs 60–75%: action
- Vs ≥75%: action
- Note any improvement rivers that change the plan (A/4/3 etc.), if relevant

Rules:
- Use % pot or bb sizes everywhere (e.g., 10–12bb, 25–33%, 50–60%, ≥75%).
- Keep gto_strategy <= 160 lines, but sufficiently detailed (not high-level).
- DO NOT mention “Hero’s hand:”/“Villain’s hand:” literally—just give the strategy.
- No markdown, no extra keys, return JSON object ONLY.

Write exploit_deviation as 2–4 crisp sentences with pool-adjustments (e.g., live pools under-bluff big rivers → overfold one-pair). No hand reveals.

Write learning_tag as 1–3 short tags, e.g. ["SB vs CO 3-bet pot","Small-bet low boards","Overfold big river"].
`.trim();

// small checker: do we have required detail?
function looksDetailed(json: any) {
  const s: string = (json?.gto_strategy ?? "").toLowerCase();
  if (!s) return false;
  const hasSections =
    s.includes("preflop:") &&
    s.includes("flop:") &&
    s.includes("turn:") &&
    s.includes("river:");
  const hasSizes = /(\d{1,2}\s*bb|\d{1,2}\s*–\s*\d{1,2}\s*bb|\d{1,3}%)/.test(s);
  const hasReactions =
    s.includes("25") && s.includes("50") && (s.includes("60") || s.includes("75"));
  return hasSections && hasSizes && hasReactions && s.length > 400;
}

function normalizeTags(val: any): string[] {
  if (Array.isArray(val)) return val.map(String).map(t => t.trim()).filter(Boolean);
  if (typeof val === "string")
    return val.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
  return [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      date,
      stakes,
      position,
      cards,
      villainAction,
      board = "",
      notes = "",
    } = body || {};

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const userBlock = `
Hand Summary
- Position: ${position ?? "unknown"}
- Stakes: ${stakes ?? "unknown"}
- Cards: ${cards ?? "unknown"}
- Board/Street Info: ${board || "n/a"}
- Villain Action (free text): ${villainAction ?? "n/a"}
- Notes: ${notes || "n/a"}
- If date is present: ${date ?? "n/a"}

Task
Use the above to produce the detailed JSON as required in the SYSTEM.
`.trim();

    // First attempt
    const first = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
      response_format: { type: "json_object" },
    });

    const text1 =
      first?.choices?.[0]?.message?.content?.trim() || "{}";

    let out: any;
    try {
      out = JSON.parse(text1);
    } catch {
      out = { gto_strategy: "", exploit_deviation: "", learning_tag: [] };
    }

    // Quality guard: if not detailed enough, reprompt to "fix" ONLY gto_strategy
    if (!looksDetailed(out)) {
      const fixPrompt = `
Here is the JSON you returned. Rewrite ONLY the gto_strategy field to conform strictly to the SYSTEM format (full Preflop/Flop/Turn/River with multiple bet-size reactions). Keep exploit_deviation and learning_tag unchanged. Return JSON only.

JSON:
${JSON.stringify(out)}
`.trim();

      const second = await openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: fixPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const text2 = second?.choices?.[0]?.message?.content?.trim() || "{}";
      try {
        const fixed = JSON.parse(text2);
        if (looksDetailed(fixed)) out = fixed;
      } catch {
        // keep original out if parse fails
      }
    }

    // Normalize tags
    out.learning_tag = normalizeTags(out.learning_tag);

    return NextResponse.json(out);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Failed to analyze hand" },
      { status: 500 }
    );
  }
}
