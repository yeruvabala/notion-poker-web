// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** ---- Lightweight extraction helpers (server-side) ---- */
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

// "effective 12bb", "12 bb eff", "stack 35bb", etc.
function parseEffectiveBB(t: string): number | null {
  const s = (t || "").toLowerCase();
  const m =
    s.match(/(\d+(?:\.\d+)?)\s*(?:bb|big\s*blinds?)\s*(?:eff\.?|effective)?\b/) ||
    s.match(/effective\s*(?:stack|stacks?)\s*(?:size)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*bb/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

function detectMode(t: string): "tournament" | "cash" | "unknown" {
  const s = (t || "").toLowerCase();
  if (/(tourn|mtt|icm|day\d|flight|final\s*table)/i.test(s)) return "tournament";
  if (/(cash\s*game|$|\b1\/2\b|\b2\/5\b|\b5\/10\b)/i.test(s)) return "cash";
  return "unknown";
}

/** ---- System style: force a long, structured explanation ---- */
const SYSTEM = `You are a poker strategy assistant.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Style & content requirements for "gto_strategy":
- Write a DETAILED, structured explanation (8–14 bullets or short paragraphs).
- Start with a one-line verdict (e.g., "Jam is good at 12bb vs SB 2.5x open" or "Marginal—tighten with high ICM").
- Include a quick situation summary (positions, open size, effective stack).
- Explain WHY (fold equity, equity when called, SPR/playability, blocker effects).
- Add a tiny math snapshot: approximate fold equity needed or calling equities (rough ranges are fine).
- If tournament context is detected, explicitly discuss ICM risk-premium and when to tighten/loosen.
- Include “When to tighten” and “When to shove/click-it-back/call” bullets.
- If relevant, suggest alternatives (flat, small 3-bet, shove) and when each dominates.
- Keep language crisp and practical; no fluff.

"exploit_deviation":
- 2–5 concise bullets on common pool leaks here and how to deviate.

"learning_tag":
- 1–3 short tags (e.g., "BB vs SB 12bb jam", "ICM pressure", "Small pair shove vs wide steal").

No markdown fencing, no extra keys. JSON object only.`;

/** ---- Route ---- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // We now accept raw_input and notes. If notes missing, we’ll use raw_input.
    const {
      date,
      stakes,
      position,
      cards,
      villainAction = "",
      board = "",
      notes = "",
      raw_input = ""    // NEW: from client we’ll pass the full “Hand Played” text here
    } = body ?? {};

    // Prefer the longest descriptive text for better reasoning
    const narrative = [notes, raw_input].filter(Boolean).sort((a, b) => b.length - a.length)[0] || "";

    // Server-side hints to give the model more structure
    const effBB = parseEffectiveBB(narrative);
    const mode = detectMode(narrative);

    const hints = [
      effBB ? `Detected effective stack: ~${effBB}bb.` : "",
      mode !== "unknown" ? `Game type: ${mode}.` : "",
      `If this is BB vs SB or BvB, discuss wide SB steals and BB jam/call/3-bet mix.`,
      `If narrative implies "SB opens X" and "BB jams/calls", analyze that node explicitly.`
    ]
      .filter(Boolean)
      .join(" ");

    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board (if any): ${board ?? ""}`,
      `Villain Action (parsed field): ${villainAction ?? ""}`,
      `Narrative (full hand text): ${narrative}`,
      `Assistant hints: ${hints}`
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,            // allow room for the detailed write-up
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
      response_format: { type: "json_object" }
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
        : []
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
