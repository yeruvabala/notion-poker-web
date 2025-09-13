// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** ---- Utils ---- */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

/** Lightweight tournament detector: we only support cash in this build */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","left","itm","in the money","final table","bubble",
    "level ","l1","l2","l10","bba","bb ante","ante","day 1","day 2","min-cash","pay jump","payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  // detect level-like "1k/2k/2k ante" patterns
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/** ---- System prompt with strict template ---- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY strict JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string"]
}

The "gto_strategy" value MUST be a single plain-text note using EXACTLY these headings:
SITUATION
PREFLOP
FLOP
TURN
RIVER
WHY

Rules:
- If any section would be empty, write "n/a" for that section, but DO NOT omit the heading.
- Cash games only: ignore any tournament/ICM concepts if present in the user's text.
- Be prescriptive and specific; avoid generic advice. Include actions + sizes (bb or % pot).

Section content guidance:

SITUATION
- Positions and node (e.g., SRP BTN vs BB / 3BP), effective stack, pot to street, SPR.

PREFLOP
- One sentence with the action and size recommendation (or "n/a" if we're postflop only).

FLOP
- Range/Nuts Advantage: who and why (1–2 lines).
- Value Bets: list concrete hand buckets (e.g., "Kx top pairs, 66–88, strong draws").
- Bluffs / Semi-Bluffs: list buckets (e.g., "BDFD + overcards, wheel gutters").
- Size & Frequency: 1–2 standard sizes with rough freq (e.g., "b25 ~70%, b66 ~30%").
- Check-Backs: which hands and why.

TURN
- Card Effect: how the turn shifts equity/nuts.
- Bet Plan: sizes + which value/bluff buckets continue.
- Slowdowns: hands that should check more.
- vs Raise: what continues, what folds.

RIVER
- Good rivers to barrel; bad rivers to shut down; thin value notes; jam vs block guidance if relevant.

WHY
- 3–5 bullets: equity/nuts edge, protection/realization, blocker effects, and fold-equity math:
  FE ≈ risk / (risk + reward) where risk/reward are in bb or pot units.

Keep the entire output compact but information-dense. No markdown, no extra keys. Temperature low (deterministic).`;

/** Required headings for validation/repair */
const REQUIRED_HEADINGS = ["SITUATION", "PREFLOP", "FLOP", "TURN", "RIVER", "WHY"] as const;
type RequiredHeading = typeof REQUIRED_HEADINGS[number];

function missingHeadings(text: string): RequiredHeading[] {
  const present = new Set(
    (text || "").split(/\n/).map(l => l.trim().toUpperCase())
      .filter(l => REQUIRED_HEADINGS.includes(l as RequiredHeading))
  );
  return REQUIRED_HEADINGS.filter(h => !present.has(h));
}

/** ---- OpenAI call helpers ---- */
async function callModel(userBlock: string) {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.15,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userBlock },
    ],
  });
  const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
  }
  return {
    gto: asText(parsed?.gto_strategy || ""),
    exploit: asText(parsed?.exploit_deviation || ""),
    tags: Array.isArray(parsed?.learning_tag)
      ? parsed.learning_tag.filter((t: any) => typeof t === "string" && t.trim())
      : [],
  };
}

async function repairIfNeeded(userBlock: string, gto: string) {
  const missing = missingHeadings(gto);
  if (missing.length === 0) return { gto, repaired: false };

  const repairPrompt =
    `Your previous answer missed these required headings: ${missing.join(", ")}.\n` +
    `Reprint the ENTIRE note in the exact required format and headings.\n` +
    `Do not add extra keys.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userBlock },
      { role: "assistant", content: JSON.stringify({ gto_strategy: gto, exploit_deviation: "", learning_tag: [] }) },
      { role: "user", content: repairPrompt },
    ],
  });

  const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";
  let newGto = gto;
  try {
    const fixed = JSON.parse(raw);
    newGto = asText(fixed?.gto_strategy || gto);
  } catch {
    // keep original
  }
  return { gto: newGto, repaired: true };
}

/** ---- Route ---- */
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

    // Cash-only guard (we can relax later if you add MTT support)
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy:
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `This build analyzes CASH games only. Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
      });
    }

    // First pass
    const first = await callModel(userBlock);

    // Validate headings; one quick repair pass if needed
    const repaired = await repairIfNeeded(userBlock, first.gto);

    // We can keep exploit/tags from the first pass (they're orthogonal to headings)
    return NextResponse.json({
      gto_strategy: repaired.gto,
      exploit_deviation: first.exploit,
      learning_tag: first.tags,
    });
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
