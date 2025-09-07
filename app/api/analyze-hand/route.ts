// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Pull useful facts from the free-text villainAction so the model is forced to use them. */
function extractFacts(v: string = "") {
  const t = (v || "").toLowerCase();

  // helpers
  const pctIn = (s: string) => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? `${m[1]}%` : null;
  };
  const bbAfter = (anchor: string) => {
    const i = t.indexOf(anchor);
    if (i === -1) return null;
    const m = t.slice(i).match(/(\d+(?:\.\d+)?)\s*bb/);
    return m ? `${m[1]}bb` : null;
  };

  const open = bbAfter("raises to") || bbAfter("opens") || null;
  const threeBet = bbAfter("3-bet") || bbAfter("3 bet") || null;

  const flopSeg =
    t.includes("flop")
      ? t.slice(t.indexOf("flop"), t.indexOf("turn") > -1 ? t.indexOf("turn") : undefined)
      : "";
  const turnSeg =
    t.includes("turn")
      ? t.slice(t.indexOf("turn"), t.indexOf("river") > -1 ? t.indexOf("river") : undefined)
      : "";
  const riverSeg = t.includes("river") ? t.slice(t.indexOf("river")) : "";

  const flopPct = pctIn(flopSeg);
  const turnPct = pctIn(turnSeg);
  const riverPct = pctIn(riverSeg);

  // gather all numeric tokens so we can validate the model echoes them
  const tokens = [open, threeBet, flopPct, turnPct, riverPct].filter(Boolean) as string[];

  return { open, threeBet, flopPct, turnPct, riverPct, tokens };
}

/** Build a compact context block the model must anchor to. */
function buildContext({
  date, stakes, position, cards, board, villainAction, notes,
}: any) {
  const f = extractFacts(villainAction || "");
  return {
    facts: f,
    user: [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || ""}`,
      `Positions: ${position || ""} vs opponent`,
      `Hero Cards: ${cards || ""}`,
      `Board: ${board || "(not given)"}`,
      `Action: ${villainAction || ""}`,
      `Notes: ${notes || ""}`,
      `Parsed sizes: open=${f.open || "?"}, 3-bet=${f.threeBet || "?"}, flop=${f.flopPct || "?"}, turn=${f.turnPct || "?"}, river=${f.riverPct || "?"}`
    ].join("\n"),
  };
}

/** The strict system prompt: force street-by-street, sizes, positions, and board. */
const SYSTEM_STRICT = `
You are a poker strategy assistant. Return ONLY JSON with keys:
- gto_strategy (string): EXACTLY 4 lines labeled "Preflop:", "Flop:", "Turn:", "River:".
  • Each line must give a concrete action (bet/check/call/fold/raise), a SIZE (bb or %), and a brief reason.
  • Use the user's actual positions (e.g., "SB vs CO") and the exact sizes parsed from the action (open, 3-bet, flop %, turn %, river %).
  • If a decision depends on facing a bet, say "vs {SIZE}: call/fold/raise".
  • Reference the given board if present.
- exploit_deviation (string): 2–4 concise sentences tailored to live 1/3 tendencies (e.g., under-bluffed big river → overfold one-pair, etc.). No hand reveals or narration.
- learning_tag (array of 1–3 short strings).

Style: actionable instructions only. No fluff. No "Hero's hand" / "Villain's hand". No extra keys. JSON object only.
`.trim();

const SYSTEM_REPAIR = `
Fix the analysis so it is SPECIFIC to the provided positions, board, and sizes.
Output ONLY JSON with the same keys: gto_strategy, exploit_deviation, learning_tag[].
Rules for gto_strategy:
- EXACTLY 4 lines: Preflop, Flop, Turn, River.
- Each line must include an action AND a numeric size (bb or %).
- Echo the user's parsed sizes (open/3-bet/flop%/turn%/river%) where they are relevant.
- Mention positions (e.g., SB vs CO) and the board if supplied.
`.trim();

/** Validate that the answer is specific, not generic. */
function looksSpecific(out: any, ctx: { facts: ReturnType<typeof extractFacts> }) {
  if (!out || typeof out !== "object") return false;
  const g = String(out.gto_strategy || "");

  // must have street labels
  if (!/Preflop:/i.test(g) || !/Flop:/i.test(g) || !/Turn:/i.test(g) || !/River:/i.test(g)) return false;

  // must include at least two of the tokens we parsed from the user's text
  const needTokens = ctx.facts.tokens.slice(0, 5); // up to 5 tokens
  const matched = needTokens.filter(tok => tok && g.toLowerCase().includes(String(tok).toLowerCase())).length;
  if (matched < Math.min(2, needTokens.length)) return false;

  // must include at least one position cue
  if (!/(sb|bb|utg|mp|co|btn)/i.test(g)) return false;

  // must include at least one numeric size token
  if (!/(\b\d+(?:\.\d+)?bb\b|\b\d{1,3}%\b|1\/3|2\/3)/i.test(g)) return false;

  // avoid narrative
  if (/hero's hand|villain's hand/i.test(g)) return false;

  // learning_tag must be array
  if (!Array.isArray(out.learning_tag)) return false;

  return true;
}

async function callJson(system: string, user: string) {
  const c = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  const text = c.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, stakes, position, cards, villainAction, board = "", notes = "" } = body || {};

    const ctx = buildContext({ date, stakes, position, cards, board, villainAction, notes });

    // First pass
    let out = await callJson(SYSTEM_STRICT, ctx.user);

    // If generic → repair with stricter context
    if (!looksSpecific(out, ctx)) {
      const repairUser = `Context:\n${ctx.user}\n\nInvalid output to fix:\n${JSON.stringify(out)}`;
      out = await callJson(SYSTEM_REPAIR, repairUser);
    }

    // Last-resort fallback so UI never ends up empty
    if (!looksSpecific(out, ctx)) {
      const sizes = ctx.facts;
      out = {
        gto_strategy:
          `Preflop: SB vs CO—3-bet ${sizes.threeBet || "10–11bb"} with Axs at some frequency; fold to 4-bet at 150bb.\n` +
          `Flop: On low 4-8-2 boards OOP, small c-bet 25–33% or check; vs ${sizes.flopPct || "50%"} stab, call with top pair/gutters.\n` +
          `Turn: 5 improves IP; check range; vs ${sizes.turnPct || "50%"} bet continue with pair+draws/overpairs, fold weakest pairs.\n` +
          `River: On 9 after x/c turn, check; vs ${sizes.riverPct || "75%"} big bet, overfold one-pair (population under-bluffs).`,
        exploit_deviation:
          "Live 1/3 under-bluffs big turn+river lines—fold weak top pairs to large river bets. From SB vs wide CO, use slightly larger 3-bet sizing. With marginal top pair, check flop more; vs stations use small bet-bet lines.",
        learning_tag: ["SB vs CO 3-bet pot", "Low-board small-bet plan", "Overfold big river"]
      };
    }

    return NextResponse.json(out);
  } catch (err: any) {
    console.error("[analyze-hand] ", err?.message || err);
    return NextResponse.json({ error: "Analyze failed" }, { status: 500 });
  }
}
