import { NextRequest, NextResponse } from "next/server";
import {
  evaluateHeroAndBoard,
  parseMany,
  parseCard,
} from "@/app/lib/poker-eval";

/** Payload shapes we’ll accept (flexible on purpose). */
type AnalyzePayload = {
  // free-form story text (optional, used as fallback)
  rawText?: string;

  // direct arrays (preferred if present)
  heroCards?: string[];        // e.g. ["K♥","T♥"] or ["Kh","Th"]
  boardCards?: string[];       // e.g. ["K♦","Q♣","2♠","A♠","A♦"]

  // UI-style fields (also supported)
  flop?: string[];             // length 3
  turn?: string[];             // length 1
  river?: string[];            // length 1

  // alternative nesting you may have in the app
  board?: {
    flop?: string[];
    turn?: string[];
    river?: string[];
  };

  // anything else you already pass through; we’ll echo it back
  [k: string]: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzePayload;

    /** 1) Normalize hero cards. */
    const heroTokens = normalizeHeroCards(body);

    /** 2) Normalize board cards from any of the shapes we support. */
    const boardTokens = normalizeBoardCards(body);

    /** 3) If still missing, try to scrape from story as a last resort. */
    const fallbackNeeded =
      heroTokens.length < 2 || boardTokens.length < 3;
    if (fallbackNeeded && typeof body.rawText === "string") {
      const { heroFromStory, boardFromStory } = scrapeFromStory(body.rawText);
      if (heroTokens.length < 2 && heroFromStory.length >= 2) {
        heroTokens.splice(0, heroTokens.length, ...heroFromStory.slice(0, 2));
      }
      if (boardTokens.length < 3 && boardFromStory.length >= 3) {
        boardTokens.splice(0, boardTokens.length, ...boardFromStory.slice(0, 5));
      }
    }

    /** 4) Evaluate best 5 out of 7, produce a canonical label. */
    const { score, label: hero_hand_class } = evaluateHeroAndBoard(
      heroTokens,
      boardTokens
    );

    /** 5) Very light detected action (handy for prompts/UI). */
    const detected_action = detectRiverAction(body.rawText ?? "");

    /** 6) Build and return your enriched payload. */
    const response = {
      ...body,
      heroCards: heroTokens,
      boardCards: boardTokens,
      hero_hand_class,       // e.g., "Two Pair — Aces and Kings, kicker Queen"
      hero_hand_cat: score.cat, // 1..9 (High .. StraightFlush)
      debug: {
        usedStoryParse: fallbackNeeded,
        detected_action,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to analyze hand", detail: String(err?.message ?? err) },
      { status: 400 }
    );
  }
}

/* ------------------------------- Helpers -------------------------------- */

function normalizeHeroCards(body: AnalyzePayload): string[] {
  // 1) direct heroCards
  if (Array.isArray(body.heroCards) && body.heroCards.length >= 2) {
    return sanitizeCards(body.heroCards).slice(0, 2);
  }

  // 2) try to find "hero" tokens in the request (e.g., someone passed { hero: "Kh Th" })
  for (const key of Object.keys(body)) {
    if (/^hero/i.test(key) && typeof body[key] === "string") {
      const parsed = parseMany(String(body[key]));
      if (parsed.length >= 2) return toTokens(parsed).slice(0, 2);
    }
  }

  return [];
}

function normalizeBoardCards(body: AnalyzePayload): string[] {
  // 1) direct boardCards
  if (Array.isArray(body.boardCards) && body.boardCards.length >= 3) {
    return sanitizeCards(body.boardCards).slice(0, 5);
  }

  // 2) UI-style fields at root
  const parts: string[] = [];
  if (Array.isArray(body.flop)) parts.push(...sanitizeCards(body.flop).slice(0, 3));
  if (Array.isArray(body.turn)) parts.push(...sanitizeCards(body.turn).slice(0, 1));
  if (Array.isArray(body.river)) parts.push(...sanitizeCards(body.river).slice(0, 1));
  if (parts.length >= 3) return parts.slice(0, 5);

  // 3) nested board object
  if (body.board && typeof body.board === "object") {
    const b = body.board as AnalyzePayload["board"];
    const parts2: string[] = [];
    if (Array.isArray(b?.flop)) parts2.push(...sanitizeCards(b!.flop).slice(0, 3));
    if (Array.isArray(b?.turn)) parts2.push(...sanitizeCards(b!.turn).slice(0, 1));
    if (Array.isArray(b?.river)) parts2.push(...sanitizeCards(b!.river).slice(0, 1));
    if (parts2.length >= 3) return parts2.slice(0, 5);
  }

  return [];
}

function sanitizeCards(arr: string[]): string[] {
  // Accept "Kh", "K♥", "K h", "10d", "Td", etc.
  // Keep only items that parse into known ranks; then convert back to compact token.
  return arr
    .map((x) => parseCard(String(x)))
    .filter(Boolean)
    .map((c) => backToToken(c!));
}

function backToToken(c: { r: number; s: string }): string {
  const face =
    c.r === 14
      ? "A"
      : c.r === 13
      ? "K"
      : c.r === 12
      ? "Q"
      : c.r === 11
      ? "J"
      : c.r === 10
      ? "T"
      : String(c.r);
  return `${face}${c.s}`;
}

function toTokens(cards: { r: number; s: string }[]): string[] {
  return cards.map(backToToken);
}

/** Extremely light story scraping; meant as a last resort. */
function scrapeFromStory(text: string) {
  const heroFromStory: string[] = [];
  const boardFromStory: string[] = [];

  // hero ... with Kh Th   OR   hero kh th
  const mh = text.match(
    /hero[^A-Za-z0-9]{0,8}([AKQJT2-9]{1,2}\s*[shdc♠♥♦♣]?)\s+([AKQJT2-9]{1,2}\s*[shdc♠♥♦♣]?)/i
  );
  if (mh) {
    const a = sanitizeCards([mh[1]]);
    const b = sanitizeCards([mh[2]]);
    if (a[0]) heroFromStory.push(a[0]);
    if (b[0]) heroFromStory.push(b[0]);
  }

  // First 5 recognizable cards anywhere in text -> board fallback
  const foundTokens = Array.from(
    text.matchAll(/([AKQJT2-9]{1,2}\s*[shdc♠♥♦♣])/gi)
  ).map((m) => m[1]);
  const cleaned = sanitizeCards(foundTokens);
  if (cleaned.length >= 3) boardFromStory.push(...cleaned.slice(0, 5));

  return { heroFromStory, boardFromStory };
}

/** Very light river action detection (optional, used for prompts/UI hints). */
function detectRiverAction(story: string) {
  const s = story.toLowerCase();
  if (!s) return "unknown";
  if (/river[^.]*checks[^.]*\(?(hero|villain)?\)?/i.test(story)) return "RIVER: check-through";
  if (/overbet|140%|150%|200%/.test(s)) return "RIVER: overbet";
  if (/bets\s*(3\/4|75%|70%)/.test(s)) return "RIVER: ~75% bet";
  if (/bets\s*(1\/2|50%)/.test(s)) return "RIVER: 50% bet";
  if (/bets\s*(1\/3|33%|30%|25%)/.test(s)) return "RIVER: small bet";
  if (/jam|shove/.test(s)) return "RIVER: jam";
  if (/check/.test(s)) return "RIVER: check";
  if (/bet/.test(s)) return "RIVER: bet";
  return "unknown";
}
