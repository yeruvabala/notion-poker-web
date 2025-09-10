// app/api/parse/route.ts
import { NextResponse } from "next/server";

/** ---------------- Types ---------------- */
type ParsedFields = {
  date: string | null;
  stakes: string | null;
  position: string | null;
  cards: string | null;
  board: string | null;
  notes: string | null;
  villain_action: string | null;
};

/** ---------------- Helpers ---------------- */
const SUIT_MAP: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

function suitify(card: string) {
  const m = (card || "").replace(/\s+/g, "").match(/^([2-9TJQKA])([shdc♥♦♣♠])$/i);
  if (!m) return "";
  const r = m[1].toUpperCase();
  const s = m[2].toLowerCase();
  const suit = SUIT_MAP[s] || ("♥♦♣♠".includes(s) ? s : "");
  return suit ? `${r}${suit}` : "";
}

function suitifyLine(line: string) {
  return (line || "")
    .replace(/[\/,|]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(suitify)
    .filter(Boolean)
    .join(" ");
}

// Parse "Flop/Turn/River" from story or fall back to first 5 cards found
function parseBoard(t: string) {
  const get3 = (c: string) => suitifyLine(c).split(" ").slice(0, 3).join(" ");
  const fm = t.match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = t.match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = t.match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);

  let flop = fm ? get3(fm[1]) : "";
  let turn = tm ? suitifyLine(tm[1]).split(" ")[0] || "" : "";
  let river = rm ? suitifyLine(rm[1]).split(" ")[0] || "" : "";

  if (!flop || !turn || !river) {
    const all = suitifyLine(t).split(" ");
    if (all.length >= 5) {
      flop = flop || all.slice(0, 3).join(" ");
      turn = turn || all[3];
      river = river || all[4];
    }
  }
  return { flop, turn, river };
}

// $1/$3 or 1k/2k(/2k) etc.
function parseBlinds(t: string) {
  const s = t.replace(/,/g, " ");
  const m1 = s.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?/);
  if (m1) return m1[0];
  const m2 = s.match(/\b(\d+[kKmM]?)\s*\/\s*(\d+[kKmM]?)(?:\s*\/\s*(\d+[kKmM]?))?\s*(?:ante|bb\s*ante)?/i);
  return m2 ? m2[0] : "";
}

// Prefer hero mentions; avoid villain position
function parseHeroPosition(t: string) {
  const up = t.toUpperCase();
  // "I'm/I am/hero ... on SB/BTN/..."
  const m1 = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m1) return m1[3];
  // "am on SB", "I on SB"
  const m2 = up.match(/\b(AM|I'M|IM|I)\b[^.]{0,10}?\bON\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m2) return m2[2];
  // generic "on SB"
  const m3 = up.match(/\bON\s+(SB|BB|BTN|CO|HJ|MP|UTG(?:\+\d)?)\b/);
  if (m3) return m3[1];
  // fallback preference
  const PREF = ["SB", "BB", "BTN", "CO", "HJ", "MP", "UTG+2", "UTG+1", "UTG"];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  return "";
}

// Hero cards in compact tokens or with suits
function parseHeroCardsSmart(t: string) {
  const s = t.toLowerCase();

  // "with Ah Qs" / exact two-card tokens
  let m = s.match(/\b(?:with|holding|have|having|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(" ");

  // Two rank tokens + (s|o) or suit words: "KQs", "AJo", "A4 suited", "a4 of spades"
  m =
    s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?\b/i) ||
    s.match(/\b([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) {
    if (m[1] && /[shdc♥♦♣♠]/i.test(m[1]) && m[2] && /[shdc♥♦♣♠]/i.test(m[2])) {
      const a = suitify(m[1]);
      const b = suitify(m[2]);
      if (a && b) return `${a} ${b}`;
    } else {
      const r1 = m[1].toUpperCase();
      const r2 = m[2].toUpperCase();
      const so = (m[3] || "").toLowerCase();
      const sw = (m[4] || "").toLowerCase();
      const suitChar = sw.startsWith("spade")
        ? "♠"
        : sw.startsWith("heart")
        ? "♥"
        : sw.startsWith("diamond")
        ? "♦"
        : sw.startsWith("club")
        ? "♣"
        : "♠";
      if (r1 === r2) return `${r1}♠ ${r2}♥`;
      if (so === "s" || so === "suited" || sw) return `${r1}${suitChar} ${r2}${suitChar}`;
      if (so === "o" || so === "offsuit") return `${r1}♠ ${r2}♥`;
      return `${r1}♠ ${r2}♥`;
    }
  }
  return "";
}

// Simple ICM signal
function parseICM(t: string) {
  return /\b(icm|bubble|final table|ladder|payouts?|in the money|itm)\b/i.test(t);
}

function parseNotes(t: string) {
  const parts: string[] = [];
  const eff = t.match(/\bE?FF(?:ECTIVE)?\s*(\d+(?:\.\d+)?)\s*BB\b/i);
  const left = t.match(/\b(\d+)\s+left\b/i);
  const paid = t.match(/\b(\d+)\s+paid\b/i) || t.match(/\bITM[:\s]*\s*(\d+)\b/i);
  if (parseICM(t)) parts.push("ICM context");
  if (eff) parts.push(`Effective ${eff[1]}bb`);
  if (left) parts.push(`${left[1]} left`);
  if (paid) parts.push(`${paid[1]} paid`);
  return parts.join(" • ") || null;
}

/** ---------------- Single POST handler ---------------- */
export async function POST(req: Request) {
  const { input = "" } = await req.json().catch(() => ({ input: "" }));

  const b = parseBoard(input);
  const boardStr =
    [
      b.flop && `Flop: ${b.flop}`,
      b.turn && `Turn: ${b.turn}`,
      b.river && `River: ${b.river}`,
    ]
      .filter((x): x is string => Boolean(x))
      .join("  |  ");

  const out: ParsedFields = {
    date: null,
    stakes: parseBlinds(input) || null,
    position: parseHeroPosition(input) || null,
    cards: parseHeroCardsSmart(input) || null,
    board: boardStr || null,
    notes: parseNotes(input),
    villain_action: null,
  };

  return NextResponse.json(out);
}
