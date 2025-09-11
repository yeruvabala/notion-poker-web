// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM = `You are a poker strategy assistant.
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}
Requirements:
- Respect the provided context fields: street, hero_hand, board_struct, requires_board_suits.
- If street = "preflop": SUITS ARE NOT REQUIRED. Treat inputs like "A4s/A4o" as fully sufficient and DO NOT ask for suits.
- If street is "flop/turn/river": assume the board suits are accurate and use them. If hero_hand.exact=false (e.g., 'A4s' without exact suits), you may qualify flush-related statements briefly.
- gto_strategy: a compact but specific Preflop/Flop/Turn/River plan with sizes (bb or % pot). Start with the street that applies; include numbers.
- exploit_deviation: 2–4 concise sentences about pool tendencies and simple exploits.
- learning_tag: 1–3 short tags (e.g., "SB vs CO 3-bet pot", "Small-bet low boards", "Overfold big river").
- No markdown or extra keys. JSON object only.`;

// Small helper to stringify any shape
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards,                    // pretty label if present
      street = "preflop",
      hero_hand = null,         // {r1,r2,suited,s1,s2,exact}
      requires_board_suits = false,
      board_struct = { flop: "", turn: "", river: "" },
      board = "",
      villainAction = "",
      notes = "",
      rawText = ""
    } = body ?? {};

    // Build a single coherent user message
    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Street: ${street}`,
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
      (rawText || notes || "").trim() || "(none provided)"
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

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
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
