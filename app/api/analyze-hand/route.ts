// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** --------- Helpers --------- */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  return String(v);
}

/** Very light “tournament smell” guard — we only serve cash here */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const t = (s || "").toLowerCase();
  const hits: string[] = [];
  const terms = [
    "tournament", "mtt", "icm", "players left", "left", "itm", "in the money",
    "final table", "bubble", "level", "bba", "bb ante", "ante", "day 1",
    "day 2", "min-cash", "pay jump", "payout"
  ];
  for (const k of terms) if (t.includes(k)) hits.push(k);
  // common level syntax (1k/2k/2k etc) + ante/bba nearby
  if (/\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(t) && /ante|bba/.test(t)) {
    hits.push("level-like");
  }
  return { isMTT: hits.length > 0, hits };
}

/** --------- System prompt (Coach-Card) --------- */
const SYSTEM = `You are a tough, precise CASH-GAME poker coach. DO NOT analyze tournaments or ICM.

Return STRICT JSON with EXACT keys only:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "optional second"]
}

Write "gto_strategy" as a compact COACH-CARD in this exact order and tone (no markdown, no extra keys):

DECISION: <one clear sentence with the recommended action right now (e.g., "Fold", "Jam", "Bet 60%")>.
PRICE: <only if numbers exist — for calls give pot-odds = call/(pot+call); for shoves give FE ≈ risk/(risk+reward). Use ~ if approximate>.
RANGE: Hero <short one-liner>; Villain <short one-liner>.
WHY:
- <2–4 bullets with range edge / blockers / nut advantage / card-class impact>.
PLAN:
- Preflop: <1–2 bullets with size family>.
- Flop: <1–2 bullets with size family and value/bluff classes>.
- Turn: <1–2 bullets; if high overcard (A/K/Q)/flush-card/4-straight, say who it favors and default sizing (50–66% if range edge; otherwise mix or check)>.
- River: <1–2 bullets; include nudges: flush/4-straight/paired/brick → size guidance, blocker notes, and who continues>.
MISTAKES:
- <1 concise mistake to avoid>.
- <another concise mistake to avoid>.

Hard rules:
- CASH ONLY. If the text mentions tournaments/ICM, do NOT analyze; the caller will block it.
- Never rubber-stamp the user’s line; recommend the EV-max line as if advising ahead of time.
- Prefer concrete sizes (bb or % pot). If exact pot isn’t given, use families (25/33/50/66/75/100/jam).
- Keep it brief but information-dense. No markdown.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      villainAction = "",
      board = "",
      notes = "",
      rawText = ""
    }: {
      date?: string;
      stakes?: string;
      position?: string;
      cards?: string;
      villainAction?: string;
      board?: string;
      notes?: string;
      rawText?: string;
    } = body ?? {};

    // Build a single “user block” with everything the model may need.
    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board: ${board ?? ""}`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)"
    ].join("\n");

    // Cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text appears to be a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash-game hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"]
      });
    }

    // Ask the model for the coach-card
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
      response_format: { type: "json_object" }
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // salvage: drop the text into gto_strategy as-is
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Normalize
    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && (t as string).trim())
        : []
    };

    // Failsafe: never return empty
    if (!out.gto_strategy.trim()) {
      out.gto_strategy =
        "DECISION: Check/fold.\n" +
        "PRICE: N/A.\n" +
        "RANGE: Hero unknown; Villain unknown.\n" +
        "WHY:\n- Insufficient info to compute a profitable action.\n" +
        "PLAN:\n- Preflop: Add stacks/sizes.\n- Flop: Add exact board.\n- Turn: Add card.\n- River: Add card.\n" +
        "MISTAKES:\n- Playing without stack/size context.\n- Ignoring board texture.";
    }

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = (e as Error)?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
