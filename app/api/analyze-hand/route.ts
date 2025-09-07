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
  Prefer wording lik
