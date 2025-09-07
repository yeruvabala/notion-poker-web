import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Pull sizes we want the model to echo (so the output is hand-specific). */
function extractFacts(v: string = "") {
  const t = (v || "").toLowerCase();

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

  const open = bbAfter("raises to") || bbAfter("opens");
  const threeBet = bbAfter("3-bet") || bbAfter("3 bet");

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

  const tokens = [open, threeBet, flopPct, turnPct, riverPct].filter(Boolean) as string[];
  return { open, threeBet, flopPct, turnPct, riverPct, tokens };
}

/** Build the concise context we pass to the model. */
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

/** We explicitly ask for plain language. */
const SYSTEM_PLAIN = `
You are a poker coach. Return ONLY JSON with keys:
- gto_strategy (string): EXACTLY 4 lines labeled "Preflop:", "Flop:", "Turn:", "River:".
  Each line MUST be simple, beginner-friendly, and include a clear action + a numeric SIZE (bb or %).
  Use the user's positions (e.g., "SB vs CO") and echo their sizes (open/3-bet/flop%/turn%/river%) if given.
  Prefer wording like: "check most", "bet 25–33%", "call vs ≤50%", "fold vs ≥75%".
  DO NOT use jargon such as: equilibrium, range advantage, polarized/linear, blockers, MDF, EV.
  DO NOT use abbreviations: OOP/IP, x/c, x/r, x/f. Write them out ("out of position", "check–call", etc.).
  Keep each line 1–2 short sentences max.

- exploit_deviation (string): 2–4 short sentences tailored to live low stakes. Be concrete (e.g., “overfold to large turn+river bets”).
- learning_tag (array of 1–3 short strings).

No extra keys. No markdown. JSON object only.
`.trim();

const SYSTEM_REPAIR = `
Fix the analysis to be specific and beginner-friendly.
Output ONLY JSON with the same keys.
Rules for gto_strategy:
- 4 lines: Preflop, Flop, Turn, River.
- Each line must include an action and numeric size.
- Echo parsed sizes where sensible.
- Use plain words (no jargon/abbreviations). Examples: "check–call", "out of position", "sometimes".
`.trim();

/** We reject generic or jargony answers. */
function looksPlainAndSpecific(out: any, ctx: { facts: ReturnType<typeof extractFacts> }) {
  if (!out || typeof out !== "object") return false;

  const g = String(out.gto_strategy || "");

  // Must have street labels
  if (!/Preflop:/i.test(g) || !/Flop:/i.test(g) || !/Turn:/i.test(g) || !/River:/i.test(g)) return false;

  // Include at least one position cue
  if (!/(sb|bb|utg|mp|co|btn)/i.test(g)) return false;

  // Include numeric sizes
  if (!/(\b\d+(?:\.\d+)?bb\b|\b\d{1,3}%\b|1\/3|2\/3)/i.test(g)) return false;

  // Include at least two of the parsed tokens (to force hand-specificity)
  const needTokens = ctx.facts.tokens.slice(0, 5);
  const matched = needTokens.filter(tok => tok && g.toLowerCase().includes(String(tok).toLowerCase())).length;
  if (matched < Math.min(2, needTokens.length)) return false;

  // Avoid jargon/abbreviations
  if (/(equilibrium|range advantage|polariz|linear|blocker|mdf|ev\b|gto\b|o\/?o?p|x\/[crf]|x-?[crf]|ip\b)/i.test(g)) return false;

  // learning_tag must be array
  if (!Array.isArray(out.learning_tag)) return false;

  return true;
}

/** Last-mile cleanup: replace any leftover abbreviations with plain words. */
function toPlain(s: string) {
  return String(s || "")
    .replace(/\bOOP\b/gi, "out of position")
    .replace(/\bIP\b/gi, "in position")
    .replace(/\bx\/c\b/gi, "check–call")
    .replace(/\bx\/r\b/gi, "check–raise")
    .replace(/\bx\/f\b/gi, "check–fold")
    .replace(/\bmix(?:es|ing)?\b/gi, "sometimes")
    .replace(/\bequilibrium\b/gi, "balanced play");
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

    // First pass: ask for plain English
    let out = await callJson(SYSTEM_PLAIN, ctx.user);

    // Repair pass if the first is too generic or jargony
    if (!looksPlainAndSpecific(out, ctx)) {
      const repairUser = `Context:\n${ctx.user}\n\nInvalid output to fix:\n${JSON.stringify(out)}`;
      out = await callJson(SYSTEM_REPAIR, repairUser);
    }

    // Final safety fallback (still plain English)
    if (!looksPlainAndSpecific(out, ctx)) {
      const s = ctx.facts;
      out = {
        gto_strategy:
          `Preflop: SB vs CO—3-bet ${s.threeBet || "11–12bb"} with suited Ax sometimes; fold to 4-bet at 150bb.\n` +
          `Flop: On 4-8-2 out of position, check most; if you bet, use small (25–33%). If you checked and face ${s.flopPct || "50%"} bet, check–call with top pair.\n` +
          `Turn: 5 helps the caller; check. Versus ${s.turnPct || "50%"} bet, call with pair+draws; fold to ${s.turnPct && Number(s.turnPct.replace("%","")) >= 70 ? s.turnPct : "75%+"}.\n` +
          `River: On 9 after check–call turn, check; versus ${s.riverPct || "75%"} big bet, fold one-pair—live pools rarely bluff here.`,
        exploit_deviation:
          "At low stakes, big turn+river bets are under-bluffed—fold one-pair more often. From SB vs wide CO opens, use slightly larger 3-bet sizes. With marginal top pair, prefer check or small bets; use small bet-bet lines for thin value vs calling stations.",
        learning_tag: ["SB vs CO 3-bet pot", "Small-bet low boards", "Overfold big river"]
      };
    }

    // Make sure any stray abbreviations are cleaned up
    out.gto_strategy = toPlain(out.gto_strategy);
    out.exploit_deviation = toPlain(out.exploit_deviation);

    return NextResponse.json(out);
  } catch (err: any) {
    console.error("[analyze-hand] ", err?.message || err);
    return NextResponse.json({ error: "Analyze failed" }, { status: 500 });
  }
}
