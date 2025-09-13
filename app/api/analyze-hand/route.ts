// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** Detects tournament terms so we can keep this endpoint cash-only. */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","left","itm","in the money",
    "final table","bubble","level ","day 1","day 2","pay jump","payout",
    "bba","bb ante","ante"
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

const STRUCTURE_SPEC = `
Return ONLY strict JSON with EXACT keys:

{
  "gto_strategy": "string with the following headings in THIS order: 
SITUATION
PREFLOP
FLOP
TURN
RIVER
WHY",
  "exploit_deviation": "2–4 concise sentences about pool tendencies & how to deviate.",
  "learning_tag": ["1–3 short tags"]
}

Write the gto_strategy as plain text (no markdown) and include ALL headings.
Under each heading, use short paragraphs and bullet-like lines. Keep sizes in bb or % pot.

Mandatory content per heading:

SITUATION
- Positions and node, effective stack (bb), pot per street if known, SPR at the current street.
- One line on range/nuts advantage.

PREFLOP
- Open/defend recommendation and size (or 'given' if already postflop).

FLOP
- Range/Nuts Advantage (1–2 lines).
- Value Bets (hand buckets).
- Bluffs / Semi-Bluffs (hand buckets).
- Size & Frequency (1–2 sizes + rough mixes).
- Check-Backs (which hands and why).

TURN
- Card Effect (how the card changes things).
- Bet Plan (size(s) + value/bluff buckets that continue).
- Slowdowns (check more).
- vs Raise (what continues, what folds).

RIVER
- Good barrels vs shut-down rivers.
- Thin value notes; when to jam vs block (if applicable).

WHY
- 3–5 bullets that justify the plan:
  • equity / nuts edge,
  • protection / realization,
  • blocker logic,
  • a fold-equity calculation for your recommended turn/river bluff size:
    FE ≈ risk / (risk + reward) with the actual numbers (use the pot you inferred).
- Do NOT endorse the user's actual play. Recommend the EV-max line as if advising beforehand.

General rules:
- CASH GAME ONLY. Ignore ICM/bubble/players-left.
- If suits are unknown postflop, reason generically (e.g., "spade completes") and state assumptions.
- Always give actionable sizes and hand buckets rather than vague advice.
`;

const SYSTEM = `
You are a strong CASH-GAME NLHE coach. You speak concisely & prescriptively.
You must follow the JSON shape and the structure spec exactly.

Rules:
- CASH ONLY. Ignore tournament/ICM concepts entirely.
- If stacks are not provided, assume ~100bb effective.
- Never rubber-stamp what the user did; judge the node and give the EV-max line.
- Prefer b33/b50/b66/b75/b100/jam sizes unless the text implies exact sizes.
- Compute fold-equity with FE ≈ risk / (risk + reward) using the size you recommend.
- Use short, scannable lines. No markdown.
`;

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

/** Ensures the 6 required headings are present in order. */
function normalizeSections(s: string): string {
  const REQUIRED = ["SITUATION","PREFLOP","FLOP","TURN","RIVER","WHY"];
  let out = s || "";
  const present = REQUIRED.every(h => new RegExp(`\\b${h}\\b`).test(out));
  if (present) return out;

  // If model returned content but missed some headers, append empties to keep UI stable.
  const missing = REQUIRED.filter(h => !new RegExp(`\\b${h}\\b`).test(out));
  if (!out.trim()) {
    return REQUIRED.map(h => `${h}\n(n/a)`).join("\n\n");
  }
  return `${out}\n\n${missing.map(h => `${h}\n(n/a)`).join("\n\n")}`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date, stakes, position, cards, villainAction = "", board = "", notes = "", rawText = ""
    } = body ?? {};

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
      const out = {
        gto_strategy:
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `This endpoint analyzes CASH games only. Please re-enter as a cash hand.`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"]
      };
      return NextResponse.json(out);
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: STRUCTURE_SPEC },
        { role: "user", content: userBlock }
      ],
      response_format: { type: "json_object" }
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Salvage if the model slips formatting.
      parsed = {
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: []
      };
    }

    const gto = normalizeSections(asText(parsed?.gto_strategy || ""));
    const exploit = asText(parsed?.exploit_deviation || "");
    const tags = Array.isArray(parsed?.learning_tag)
      ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && !!(t as string).trim())
      : [];

    return NextResponse.json({
      gto_strategy: gto,
      exploit_deviation: exploit,
      learning_tag: tags
    });
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
