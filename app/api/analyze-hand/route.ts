// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** Simple tournament detector — we block if the text looks like MTT. */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","left","itm","in the money","final table","bubble",
    "level ","l1","l2","l10","bba","bb ante","ante","day 1","day 2","min-cash","pay jump","payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY strict JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Hard rules:
- CASH ONLY. If the text looks like tournament/ICM/bubble/players-left, do NOT analyze: say it's cash-only in gto_strategy and add learning_tag ["cash-only","mtt-blocked"].
- Never endorse what the user did; recommend the EV-max line as if advising beforehand.
- Assume ~100bb effective if stacks are missing.
- Sizes must be concrete (bb or % pot). Keep it concise and prescriptive. No markdown.

FORMAT your gto_strategy EXACTLY like this (plain text, exact headers, bullets start with "- "):
SITUATION
- Pot: SRP or 3-bet; Positions: <IP vs OOP>; Eff stacks: <bb>; Pot ≈ <bb>; SPR ≈ <n>.
- Board: <FLOP> (then → <TURN> → <RIVER> if provided)

PREFLOP
- Action: <open/3-bet/flat> with sizes.
- Range snapshot (Hero): <quick list>.
- Vs action: <how to react vs 3-bet/4-bet etc>.

FLOP (<F F F>)
- Advantage: <who + why>.
- Sizing plan: <b33/b50/b75/xb> (primary); alt: <optional>.
- Value: <hands>; Bluffs/Semi-bluffs: <hands>.
- Vs raise: continue with <hands>; fold <hands>.
- Best turns: <cards>; Worst turns: <cards>.

TURN (<card> added)
- Card bucket: <High overcard / Low straightener / Flush adds / Paired / Brick>.
- Who improves: <who + why>.
- Sizing family: <Block 25–33 / Mid 50–66 / Big 75–100 / Overbet 120–150 / Check HF> (reason).
- Value barrels: <hands>; Semi-bluffs: <hands>; Slowdowns: <hands>.
- Vs raise: continue with <hands>; fold <hands>.
- River setup: Best: <cards>; Worst: <cards>.

RIVER (<result>)
- Bucket: <Flush completes / 4-straight / Paired / Brick>.
- Value plan: size <…> with <…>; check <…>.
- Bluff plan: prefer blockers <…>; give-ups <…>.
- Vs raise: call with <…>; fold <…>.
- One-liner: Best rivers were <…>; worst were <…>.

WHY
- Range/Nut edge: <one sentence>.
- FE rough math: FE ≈ risk/(risk+reward) = <x>/<x+y> ≈ <p>% (use the street where you propose a bluff).
- Blockers/unblockers: <one sentence>.

Turn/River guardrails (apply across positions):
- Turn: On A/K/Q high turns in SRP where PFR retains high-card density, prefer Mid 50–66% barrels with value + best BDFD/GS; avoid over-checking middling pairs without equity.
- River: If flush completes → prefer block 25–33% with thin value + diamond blockers; if 4-straight completes → polarize (75–100%) and bluff with best blockers; if board pairs top-end → big with nutted, block with thin; on bricks → mix thin value and select bluffs that unblock folds.

exploit_deviation:
- 2–4 short sentences on typical live/online pool tendencies (overfolds to turn barrels, under-bluff rivers, etc.) and how to deviate.

learning_tag:
- 1–3 short tags like "BTN vs BB SRP", "Mid-size turn barrels", "Brick river thin value".
`;

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

/** Tiny sanitizer: ensure we at least have all section headers even if the model trims too hard. */
function enforceSections(gto: string): string {
  const need = ["SITUATION","PREFLOP","FLOP","TURN","RIVER","WHY"];
  let out = gto || "";
  for (const h of need) {
    const re = new RegExp(`^${h}\\b`, "m");
    if (!re.test(out)) {
      out += (out.endsWith("\n") ? "" : "\n") + `\n${h}\n- (fill based on context)\n`;
    }
  }
  return out.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date, stakes, position, cards, villainAction = "", board = "", notes = "", rawText = ""
    } = body ?? {};

    // Build a compact user block with all context we have
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
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(", ")}). This build analyzes CASH games only. Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"]
      };
      return NextResponse.json(out);
    }

    // Ask the model for the structured answer
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
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

    // Normalize + enforce structure
    let gto = asText(parsed?.gto_strategy || "").trim();
    gto = enforceSections(gto);

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
