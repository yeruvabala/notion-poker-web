// app/api/analyze-hand/route.ts
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

type Payload = {
  date?: string;
  stakes?: string;
  position?: string;
  cards?: string;
  villainAction?: string;
  board?: string;   // optional freeform board notes
  notes?: string;   // any extra freeform context
};

function extractJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    // try to pull from ```json ... ```
    const m = text.match(/```json\s*([\s\S]*?)```/i);
    if (m) {
      return JSON.parse(m[1]);
    }
    // try generic ```
    const m2 = text.match(/```\s*([\s\S]*?)```/);
    if (m2) {
      return JSON.parse(m2[1]);
    }
    throw new Error("Model did not return valid JSON.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;

    const system = `
You are a poker strategy assistant. You must return STRICT JSON with:
{
  "gto_strategy": string,        // EXACT 4 lines as shown below (no extra lines, no markdown)
  "exploit_deviation": string,   // 2–4 concise sentences
  "learning_tag": string[],      // 1–3 short tags
  "gto_expanded": string         // detailed branch map in plain text (can use bullets)
}

Rules for gto_strategy (concise): write EXACTLY four lines as follows:
Preflop (SB vs CO, 150bb): <single-line summary>.
Flop <FLOP_BOARD> (OOP, 3-bet pot): <single-line summary>.
Turn <TURN_CARD>: <single-line summary>.
River <RIVER_CARD>: <single-line summary>.

- Replace <FLOP_BOARD>, <TURN_CARD>, <RIVER_CARD> with detected cards if present (e.g., "4♦8♠2♣", "5♥", "9♥"). If unknown, use "-" (dash).
- Keep each line short but specific (sizes, mix, fold/call thresholds).
- No markdown. No extra keys. No narration.

Rules for gto_expanded (branch map):
- Provide a structured, sizing-conditioned decision tree for this exact hand context (position, stacks, boards, actions).
- Cover: Preflop options, Flop options → reactions to call/raise (+ sizes), Turn options → reactions by sizing, River options → reactions by sizing.
- Include "When to bet vs check", and "When to fold vs raise sizes" with rough frequency guidance (words like "often", "mostly", "mix").
- Use plain text with headings like:
  Preflop —
  Flop (4♦8♠2♣) —
  Turn (5♥) —
  River (9♥) —
- Use short bulleted lines and include the most common bet sizes (25–33%, 50–60%, 66–75%, overbet).

Exploit emphasis for exploit_deviation:
- Mention one or two actionable pool exploits tied to position/spot (e.g., river under-bluff, overfold to 3-bets, etc.).
`;

    // Build a compact user message
    const u = `
Hand context (freeform):
- Stakes: ${body.stakes ?? "-"}
- Position (Hero): ${body.position ?? "-"}
- Hero cards: ${body.cards ?? "-"}
- Villain action: ${body.villainAction ?? "-"}
- Board notes: ${body.board ?? "-"}
- Extra notes: ${body.notes ?? "-"}

Return STRICT JSON only (no markdown).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system.trim() },
        { role: "user", content: u.trim() },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const data = extractJSON(raw);

    // Basic sanitation
    const gto_strategy = String(data.gto_strategy ?? "").trim();
    const exploit_deviation = String(data.exploit_deviation ?? "").trim();
    const learning_tag = Array.isArray(data.learning_tag)
      ? data.learning_tag.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [];
    const gto_expanded = String(data.gto_expanded ?? "").trim();

    return NextResponse.json({
      gto_strategy,
      exploit_deviation,
      learning_tag,
      gto_expanded,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Analyze failed" },
      { status: 500 }
    );
  }
}
