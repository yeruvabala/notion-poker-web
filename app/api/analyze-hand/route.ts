// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ------------ light tournament detector (we are cash-only) ------------ */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","final table","bubble","itm",
    "day 1","day 2","level ","bb ante","bba","ante","pay jump","payout"
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

function extractQuestion(t: string): string {
  if (!t) return "";
  // use the last line with a question mark, else last sentence-ish
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("?")) return lines[i];
  }
  const last = lines[lines.length - 1] || "";
  // trim to something short if it's extremely long
  return last.length > 200 ? last.slice(0, 200) + "…" : last;
}

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"],

  "verdict": "BET|CHECK|CALL|FOLD|RAISE|JAM",
  "size_hint": "string",
  "confidence": 0.0,
  "played_eval": "correct|ok|thin|mistake|blunder",
  "ev_note": "string",
  "pot_odds": "string?",
  "range_notes": { "hero": "string", "villain": "string" }
}

Write "gto_strategy" as a compact coaching plan (≈180–260 words) with these sections IN THIS ORDER and IN ALL CAPS, each followed by a colon:
DECISION
SITUATION
RANGE SNAPSHOT
PREFLOP
FLOP
TURN
RIVER
NEXT CARDS
WHY
COMMON MISTAKES
LEARNING TAGS

Rules for content:
- DECISION: pick ONE action at the user’s focus node (Call/Fold/Check/Bet/Raise/Jam). If betting/raising, give a primary numeric size (e.g., "33% pot", "2/3 pot", "jam 12bb"). Add a one-line "Pot odds: ~XX%" only when facing a call; otherwise omit.
- SITUATION: one-liners: pot type (SRP/3BP), positions, effective stacks, pot/SPR if given, hero cards. Add a line "BOARD CLASS: … · Range advantage: X · Nuts advantage: X".
- RANGE SNAPSHOT: one short line each for Hero and Villain after the line taken.
- PREFLOP/FLOP/TURN/RIVER: give sizing family (numbers), 3–6 value classes, 3–6 bluff/semi-bluff classes, a brief "Slowdowns / Check-backs", and a one-line "Vs raise" rule for continues.
- NEXT CARDS: for Flop and Turn, give "Best:" and "Worst:" with 2–4 examples each.
- WHY: 3–6 bullets using range vs nuts edge, blockers/unblockers, and simple math (if FE hint or pot odds are provided).
- COMMON MISTAKES: 2–4 bullets (over/under-bluffing, sizing errors, calling too wide/narrow).
- LEARNING TAGS: 2–4 short tags like ["range-advantage","two-tone-low","spr-4"].

Exploit layer:
- After GTO, add "exploit_deviation" with 2–4 short sentences (not bullets) describing pool exploits (e.g., live low stakes overfold river raises; online reg pools stab too often vs turn checks).

General rules:
- CASH only; ignore ICM/players-left entirely.
- Be prescriptive, not narrative. No markdown/code fences.
- When info is missing, assume reasonable cash defaults (100bb, standard sizes) and proceed.
- The “verdict/size_hint/confidence/played_eval/ev_note/pot_odds/range_notes” fields must be filled consistently with the DECISION.
`;

/* ----------------------- route handler ----------------------- */
type AnalyzeReq = {
  date?: string;
  stakes?: string;
  position?: string;
  cards?: string;
  board?: string;
  notes?: string;
  rawText?: string;
  fe_hint?: string;
  spr_hint?: string;
  question?: string;   // optional: explicit "raise or check?" etc
  hero_line?: string;  // optional: concise line of actions hero actually took
};

type ModelOut = {
  gto_strategy?: string;
  exploit_deviation?: string;
  learning_tag?: string[];
  verdict?: string;
  size_hint?: string;
  confidence?: number | string;
  played_eval?: string;
  ev_note?: string;
  pot_odds?: string;
  range_notes?: { hero?: string; villain?: string };
};

export async function POST(req: Request) {
  try {
    const body: AnalyzeReq = await req.json();

    const {
      date,
      stakes,
      position,
      cards,
      board = "",
      notes = "",
      rawText = "",
      fe_hint,
      spr_hint,
      question,
      hero_line
    } = body ?? {};

    const combinedText = `${rawText || ""}\n${notes || ""}`.trim();
    const inferredQuestion = question?.trim() || extractQuestion(combinedText);

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
      inferredQuestion ? `QUESTION: ${inferredQuestion}` : ``,
      hero_line ? `HERO_LINE: ${hero_line}` : ``,
      ``,
      `RAW HAND TEXT:`,
      combinedText || "(none provided)",
      ``,
      `FOCUS: Identify the exact street the QUESTION refers to and make the DECISION for that node first, with a numeric size if betting. CASH ONLY.`
    ]
      .filter(Boolean)
      .join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      const out: ModelOut = {
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
        verdict: "CHECK",
        size_hint: "",
        confidence: 0.0,
        played_eval: "ok",
        ev_note: "",
        pot_odds: "",
        range_notes: { hero: "", villain: "" }
      };
      return NextResponse.json(out);
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

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: ModelOut = {};
    try {
      parsed = JSON.parse(raw) as ModelOut;
    } catch {
      // fallback: stuff raw into gto_strategy
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Normalize output and ensure required fields exist
    const confidenceNum =
      typeof parsed.confidence === "string"
        ? Math.max(0, Math.min(1, parseFloat(parsed.confidence)))
        : typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.0;

    const out: Required<ModelOut> = {
      gto_strategy: asText(parsed.gto_strategy || ""),
      exploit_deviation: asText(parsed.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed.learning_tag)
        ? parsed.learning_tag.filter((t) => typeof t === "string" && t.trim())
        : [],
      verdict: (parsed.verdict || "").toUpperCase() as any,
      size_hint: asText(parsed.size_hint || ""),
      confidence: confidenceNum,
      played_eval: (parsed.played_eval || "").toLowerCase() as any,
      ev_note: asText(parsed.ev_note || ""),
      pot_odds: asText(parsed.pot_odds || ""),
      range_notes: {
        hero: asText(parsed.range_notes?.hero || ""),
        villain: asText(parsed.range_notes?.villain || "")
      }
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
