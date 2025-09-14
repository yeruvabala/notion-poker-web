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
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
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

/* ----------------------- system prompt ----------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY. 
Return ONLY JSON with EXACT keys:
{
  "decision": {
    "action": "Fold|Call|Check|Bet 25%|Bet 33%|Bet 50%|Bet 66%|Bet 75%|Overbet|Raise small|Raise big|Jam|Check-call|Check-raise|Check-fold",
    "confidence": "High|Medium|Low",
    "summary": "one sentence with the street and what to do now",
    "why": ["3–6 short bullets with range/texture/position logic"],
    "math": {
      "pot_odds": "e.g., 28%",
      "equity_needed": "e.g., 28%",
      "fe_needed": "e.g., 36%" 
    }
  },
  "assumptions": "short sentence of assumptions ONLY when multi-way or some inputs missing; else empty string",
  "multiway": true,
  "gto_strategy": "compact 180–260 words with SITUATION / RANGE SNAPSHOT / PREFLOP / FLOP / TURN / RIVER / WHY / COMMON MISTAKES / LEARNING TAGS (labels in ALL CAPS, keep concise bullets; no markdown)",
  "exploit_deviation": "2–4 bullets of pool exploits",
  "learning_tag": ["2–4 short tags"]
}

/* Decision focus */
- Identify the user's TARGET NODE automatically: if the text contains an explicit question (e.g., 'call or fold?', 'jam or call?'), answer THAT street; else prefer river > turn > flop > preflop based on last action described.
- Output a single clear "action" label from the allowed set above (choose the closest wording if sizes differ slightly).
- Include quick math whenever facing a bet or considering a shove/raise: 
  - pot_odds = call / (pot + call)
  - equity_needed ≈ pot_odds
  - fe_needed ≈ risk / (risk + reward) when jamming/bluff-raising.
- Use positions, hero hand, board, sizes, and SPR hints if given.

/* Multi-way guardrails */
- If pot is multiway (3+ players any time this street), set "multiway": true, add a one-line "assumptions", and degrade confidence by one step (High→Medium, Medium→Low) unless the spot is trivial.
- Multiway adjustments: reduce bluffing frequency, value bet a bit thinner in position only when appropriate, and be stricter on thin bluff-catches OOP.

/* Turn/River nudges (global) */
- On A/K/Q overcard turns where the aggressor retains range advantage, prefer pressure with mid sizes when uncapped; slow with mid-low strength. 
- Rivers: give guidance for flush-completes, 4-straights, paired boards, and bricks; mention blockers/unblockers briefly.

/* Style */
- CASH only; ignore ICM/players-left entirely.
- Be prescriptive, not narrative. No markdown, no code blocks.
- Keep "gto_strategy" compact but information-dense with the section labels in ALL CAPS as requested.
`;

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
      fe_hint,          // optional FE % hint (from FE card)
      spr_hint          // optional SPR hint (from SPR card)
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

    // Compact user block the model will read
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
      (rawText || notes || "").trim() || "(none provided)"
    ].filter(Boolean).join("\n");

    // cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        decision: {
          action: "Fold",
          confidence: "Low",
          summary: "Cash-only mode: this looks like a tournament hand; re-enter as a cash hand.",
          why: ["ICM/MTT is out of scope for this build."],
          math: { pot_odds: "", equity_needed: "", fe_needed: "" }
        },
        assumptions: "",
        multiway: false,
        gto_strategy:
          `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"]
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

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // salvage shape if model slipped
      parsed = {
        decision: {
          action: "Call",
          confidence: "Low",
          summary: raw.slice(0, 140),
          why: [],
          math: { pot_odds: "", equity_needed: "", fe_needed: "" }
        },
        assumptions: "",
        multiway: false,
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: []
      };
    }

    // Normalize + sanitize
    const out = {
      decision: {
        action: asText(parsed?.decision?.action || ""),
        confidence: asText(parsed?.decision?.confidence || ""),
        summary: asText(parsed?.decision?.summary || ""),
        why: Array.isArray(parsed?.decision?.why)
          ? parsed.decision.why.filter((t: any) => typeof t === "string" && t.trim())
          : [],
        math: {
          pot_odds: asText(parsed?.decision?.math?.pot_odds || ""),
          equity_needed: asText(parsed?.decision?.math?.equity_needed || ""),
          fe_needed: asText(parsed?.decision?.math?.fe_needed || ""),
        }
      },
      assumptions: asText(parsed?.assumptions || ""),
      multiway: !!parsed?.multiway,
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
