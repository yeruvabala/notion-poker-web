// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ------------ light tournament detector (cash-only guard) ------------ */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament", "mtt", "icm", "players left", "final table", "bubble", "itm",
    "day 1", "day 2", "level ", "bb ante", "bba", "ante", "pay jump", "payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ----------------------- small helpers ----------------------- */
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

type MixedOption = {
  action?: string;        // CALL | FOLD | CHECK | BET | RAISE
  size_hint?: string;     // e.g., "25%", "33%", "2.5x"
  freq?: string;          // "~55%"
  when?: string;          // short reason/condition
};

function sanitizeOptions(v: unknown): MixedOption[] {
  if (!Array.isArray(v)) return [];
  const ALLOWED = new Set(["CALL", "FOLD", "CHECK", "BET", "RAISE"]);
  return v
    .map((o: any) => ({
      action: typeof o?.action === "string" && ALLOWED.has(o.action.toUpperCase())
        ? o.action.toUpperCase()
        : undefined,
      size_hint: typeof o?.size_hint === "string" ? o.size_hint.trim() : undefined,
      freq: typeof o?.freq === "string" ? o.freq.trim() : undefined,
      when: typeof o?.when === "string" ? o.when.trim() : undefined,
    }))
    .filter(o => !!o.action);
}

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY strict JSON with exactly these top-level keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", ...],
  "verdict": "CALL" | "FOLD" | "CHECK" | "BET" | "RAISE" | "MIXED",
  "size_hint": "string (optional; for BET/RAISE give primary size, e.g., '33%' or '2.5x')",
  "options": [
    {
      "action": "CALL" | "FOLD" | "CHECK" | "BET" | "RAISE",
      "size_hint": "string (optional; needed if BET/RAISE)",
      "freq": "string like '~60%'",
      "when": "one concise reason/condition"
    }
  ] (optional; required when verdict='MIXED')
}

Decision format and MIXED policy:
- Always set "verdict" to exactly one of CALL/FOLD/CHECK/BET/RAISE/MIXED.
- If "verdict" is BET or RAISE, include a "size_hint" like "25%", "33%", "half-pot", or "2.5x".
- If more than one line is viable (≥25% each), use "verdict":"MIXED" and list 2–3 entries in "options".
  Each option must include "action", a rough "freq" (e.g., "~55%"), and a short "when" explaining *why/when*.
  If the option is BET/RAISE, also include "size_hint".
- Keep "gto_strategy" concise (≈180–260 words) with sections like:
  DECISION (state the action or that it's MIXED, and give sizes), SITUATION, RANGE SNAPSHOT,
  PREFLOP / FLOP / TURN / RIVER (sizing families + examples), NEXT CARDS, WHY, COMMON MISTAKES, LEARNING TAGS.
- CASH only; ignore ICM/players-left entirely.
- No markdown, no code fences, and the response must be valid JSON (no comments).`;

/* ----------------------- route handler ----------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      date,
      stakes,
      position,
      cards,
      board = "",
      notes = "",
      rawText = "",
      fe_hint,          // optional FE % hint string ("xx.x%")
      spr_hint          // optional SPR hint
    }: {
      date?: string;
      stakes?: string;
      position?: string;
      cards?: string;
      board?: string;
      notes?: string;
      rawText?: string;
      fe_hint?: string;
      spr_hint?: string;
    } = body ?? {};

    // Compact user block for the model
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      ``,
      `RAW HAND TEXT:`,
      (rawText || notes || "").trim() || "(none provided)",
      ``,
      `FOCUS: If multiple lines are reasonable (≥25% each), return verdict=MIXED and fill "options" with action/size_hint/freq/when. Otherwise choose a single best line and, if betting/raising, include size_hint.`
    ].filter(Boolean).join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
        verdict: "MIXED",
        size_hint: "",
        options: [
          { action: "CHECK", freq: "~50%", when: "Blocked due to MTT/ICM references" },
          { action: "FOLD",  freq: "~50%", when: "Blocked due to MTT/ICM references" }
        ]
      });
    }

    // call LLM
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
    });

    // Parse model JSON (be strict but with a fallback)
    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    type ModelOut = {
      gto_strategy?: string;
      exploit_deviation?: string;
      learning_tag?: string[];
      verdict?: string;
      size_hint?: string;
      options?: MixedOption[];
    };

    let parsed: ModelOut = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: keep text in gto_strategy so the UI shows something,
      // but still return empty decision fields (tests will show as unknown).
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Sanitize / coerce
    const ALLOWED_VERDICTS = new Set([
      "CALL", "FOLD", "CHECK", "BET", "RAISE", "MIXED"
    ]);

    let verdict = (parsed?.verdict || "").toUpperCase();
    if (!ALLOWED_VERDICTS.has(verdict)) verdict = ""; // keeps tests honest

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t) => typeof t === "string" && t.trim())
        : [],
      verdict,
      size_hint:
        typeof parsed?.size_hint === "string" ? parsed.size_hint.trim() : "",
      options: sanitizeOptions(parsed?.options)
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
