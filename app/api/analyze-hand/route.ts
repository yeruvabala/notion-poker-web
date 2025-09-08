// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * SYSTEM prompt forces:
 * - Explicit street cards printed (with suits if provided) in each street header
 * - Detailed, size-specific plan per street
 * - JSON-only output with fixed keys
 */
const SYSTEM = `
You are a poker strategy assistant. Return ONLY JSON.

JSON OBJECT MUST HAVE EXACT KEYS:
- gto_strategy (string)
- exploit_deviation (string)
- learning_tag (array of 1–3 short strings)

CRITICAL: Extract the actual street cards from the user's text:
- Look in "Board/Street Info" and "Villain Action" for phrases like:
  "flop comes K♣7♦2♣", "turn is 5♥", "river is 9♣", "Flop: Ah Kd 2c", etc.
- If suits are present, include them (e.g., "K♣ 7♦ 2♣"). If suits are absent, use ranks only (e.g., "K 7 2").
- If a street is truly unknown, write "unknown" for that street.

Write gto_strategy as a DETAILED street-by-street checklist for THIS EXACT HAND.
Use concise bullet sentences, and ALWAYS include specific sizes and reactions.

REQUIRED gto_strategy TEMPLATE (fill with the user's info AND show street cards):
Preflop: (villain position, hero position, stack depth)
- 3-bet size (in bb) and frequency for THIS combo
- Vs 4-bet (25–30bb typical): exact response for THIS combo at this depth (fold / 5-bet bluff % / call)

Flop: [SHOW CARDS e.g., "4♣ 8♦ 2♠"] (state texture: rainbow/two-tone/monotone; say who is OOP/IP)
- Range plan (check/c-bet mix; give % if useful)
- With THIS combo (implicitly): preferred action
  - If face 25–33% bet: action
  - If face 50–60% bet: action
  - If face ≥75% bet: action
  - If you c-bet 25–33% and face ~3x raise: action

Turn: [SHOW CARD e.g., "5♥"] (note equity/interaction)
- Range plan (who increases EV, who slows)
- With THIS combo:
  - If face 40–60%: action
  - If face 75%+: action
  - If checked through: when to stab and size

River: [SHOW CARD e.g., "9♣"] (note if improves/neutral/bricks)
- Default action for THIS combo
- Vs 25–40%: action
- Vs 60–75%: action
- Vs ≥75%: action
- Note any improvement rivers that change the plan (A/4/3 etc.), if relevant

Rules:
- Use % pot or bb sizes everywhere (e.g., 10–12bb, 25–33%, 50–60%, ≥75%).
- Keep gto_strategy sufficiently detailed (not high-level).
- DO NOT mention “Hero’s hand:”/“Villain’s hand:” literally—just give the strategy.
- No markdown, no extra keys, return JSON object ONLY.

Write exploit_deviation as 2–4 crisp sentences with pool-adjustments (e.g., live pools under-bluff big rivers → overfold one-pair). No hand reveals.

Write learning_tag as 1–3 short tags, e.g. ["SB vs CO 3-bet pot","Small-bet low boards","Overfold big river"].
`.trim();

// ---- helpers ----
function normalizeToLowerString(val: any): string {
  try {
    if (typeof val === "string") return val.toLowerCase();
    if (val == null) return "";
    return String(typeof val === "object" ? JSON.stringify(val) : val).toLowerCase();
  } catch {
    return "";
  }
}

function looksDetailed(json: any) {
  const s = normalizeToLowerString(json?.gto_strategy);
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
  try {
    if (Array.isArray(val)) return val.map(String).map(t => t.trim()).filter(Boolean).slice(0, 3);
    if (typeof val === "string")
      return val.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
    return [];
  } catch {
    return [];
  }
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
Use the above to produce the detailed JSON as required in the SYSTEM,
AND print explicit street cards in each street header (Flop/Turn/River) if you can extract them.
`.trim();

    // First pass
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

    const text1 = first?.choices?.[0]?.message?.content?.trim() || "{}";
    let out: any;
    try {
      out = JSON.parse(text1);
    } catch {
      out = { gto_strategy: "", exploit_deviation: "", learning_tag: [] };
    }

    // If too light, repair pass
    if (!looksDetailed(out)) {
      const fixPrompt = `
Rewrite ONLY the gto_strategy field to strictly follow the SYSTEM's format
(including explicit Flop/Turn/River cards if available). Keep exploit_deviation and
learning_tag unchanged. Return JSON only.

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
        // keep original if parse fails
      }
    }

    // Normalize types
    out.learning_tag = normalizeTags(out.learning_tag);
    if (typeof out.gto_strategy !== "string") out.gto_strategy = String(out.gto_strategy ?? "");
    if (typeof out.exploit_deviation !== "string") out.exploit_deviation = String(out.exploit_deviation ?? "");

    return NextResponse.json(out);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Failed to analyze hand" },
      { status: 500 }
    );
  }
}
