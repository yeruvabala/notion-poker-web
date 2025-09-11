// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * STRICT strategy generator (no user-line bias).
 * Returns only: gto_strategy, exploit_deviation, learning_tag
 */
const SYSTEM = `You are a tough, prescriptive poker coach. You must recommend the BEST play, not what the user did.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

HARD RULES (no exceptions):
- NEVER endorse a line because the user took it. Ignore "I shoved/called" etc.
- First line of gto_strategy MUST be: "Decision: <best action>." 
  Examples: "Decision: Fold pre.", "Decision: Call 7bb 3-bet.", "Decision: 4-bet jam 18bb.", 
            "Decision: Check-raise 33% range to 9bb.", "Decision: Bet 33% pot."
- If the user's described action differs from your decision, add one short sentence right after the Decision line: 
  "Hero's line was a mistake because <fast reason>." Keep it short and factual.

Context handling:
- Use all given context (cash vs. tournament, ICM, bubble/final table, stacks in bb, positions, sizings, street, board).
- If text indicates bubble/ICM or a short stack creating pressure, tighten stack-off thresholds and prefer risk-averse lines.
- Preflop ONLY: suits aren't required; treat "A4s/A4o" as sufficient. Do NOT ask for suits.
- Postflop: use board suits for flush logic. If hero's suits aren't known, qualify statements briefly (e.g., "if hearts").

GTO STRATEGY CONTENT (compact but information-dense; bullet-style short sentences):
1) Spot summary: positions, effective stack, preflop pot/SPR if inferable.
2) Preflop plan (always include): open sizes/frequencies; vs 3-bet/4-bet; FE threshold ~= risk/(risk+reward) when applicable.
3) Flop plan (if street >= flop): default sizes/frequencies; hero hand class; vs check-raise response; quick pot-odds/equity snippet.
4) Turn plan (if street >= turn): best/worst turn cards; barrel vs check with sizes and quick threshold guidance.
5) River plan (if street = river or likely): thin value vs check; jam/call thresholds; bluff:value ratio hints and size(s).

EXPLOITS:
- 2–4 concise sentences on pool tendencies in THIS node and how to deviate.

TAGS:
- 1–3 short tags like "UTG vs UTG+1 3-bet", "ICM bubble", "HJ vs BB SRP", "Low paired board small bet".

No markdown. No extra keys.`;

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
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
      cards,                    // pretty label (e.g., "A4s", "22", "KQs")
      street = "preflop",
      hero_hand = null,         // { r1,r2,suited:boolean|null,s1,s2,exact:boolean }
      requires_board_suits = false,
      board_struct = { flop: "", turn: "", river: "" },
      board = "",
      villainAction = "",
      notes = "",
      rawText = "",
      detail_level = "high",
    } = body ?? {};

    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Street: ${street}`,
      `Detail: ${detail_level}`,
      `Hero: ${cards || (hero_hand ? `${hero_hand.r1}${hero_hand.r2}${hero_hand.suited===true?'s':hero_hand.suited===false?'o':''}` : "")}`,
      `Hero exact suits known: ${hero_hand?.s1 && hero_hand?.s2 ? "yes" : "no"}`,
      `Requires Board Suits: ${requires_board_suits ? "yes" : "no"}`,
      `Board: ${board || [
        board_struct?.flop && `Flop: ${board_struct.flop}`,
        board_struct?.turn && `Turn: ${board_struct.turn}`,
        board_struct?.river && `River: ${board_struct.river}`,
      ].filter(Boolean).join(" | ")}`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)",
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
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Minimal normalization
    let gto = asText(parsed?.gto_strategy || "");
    // Safety: enforce leading "Decision:" line if model misses it
    if (!/^Decision:\s*/i.test(gto)) {
      gto = `Decision: Choose the highest-EV line.\n` + gto;
    }

    const out = {
      gto_strategy: gto,
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
