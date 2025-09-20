// app/api/analyze-hand/route.ts
import { NextRequest, NextResponse } from "next/server";
import { evaluateHeroAndBoard, parseMany } from "@/app/lib/poker-eval";

/** Types of what the client may POST */
type SummaryCards = {
  hero?: string[]; // e.g. ["Kh","Th"] or ["K♥","T♥"]
  flop?: string[]; // 0..3
  turn?: string[]; // 0..1
  river?: string[]; // 0..1
};

type SummaryEditors = {
  position?: string; // BTN / CO / SB / BB / UTG / etc
  stakes?: string;   // "1/3" etc
  actionHint?: string; // optional: "river: facing-bet" | "river: check-through"
  cards?: SummaryCards;
};

type Body = {
  // optional raw story text (hand played)
  story?: string;
  // optional parsed summary editors data
  summary?: SummaryEditors;
  // UI can send which source it believes it’s using
  source?: "summary" | "story" | "auto";
};

/** Utility: safe array concat while filtering undefined/empty */
const safeArr = (...chunks: (string[] | undefined | null)[]) =>
  chunks.flatMap((x) => (Array.isArray(x) ? x.filter(Boolean) : []));

function pickSource(body: Body): "summary" | "story" {
  if (body.source === "summary") return "summary";
  if (body.source === "story") return "story";
  // auto: prefer summary if present and has any card
  const anySummaryCard =
    !!body.summary?.cards?.hero?.length ||
    !!body.summary?.cards?.flop?.length ||
    !!body.summary?.cards?.turn?.length ||
    !!body.summary?.cards?.river?.length;
  return anySummaryCard ? "summary" : "story";
}

/** Very light story parser fallback (keeps things robust if you only send text) */
function parseStoryForCards(story?: string) {
  const result = {
    hero: [] as string[],
    flop: [] as string[],
    turn: [] as string[],
    river: [] as string[],
  };
  if (!story) return result;

  // grab anything that looks like a card token (Kh, K♥, 10h, Td, etc.)
  const tokens = story
    .split(/[\s,;()]+/g)
    .filter(Boolean)
    .map((t) => t.trim());

  // naive segmentation by keywords
  const flopIdx = story.toLowerCase().indexOf("flop");
  const turnIdx = story.toLowerCase().indexOf("turn");
  const riverIdx = story.toLowerCase().indexOf("river");

  const flopText =
    flopIdx >= 0
      ? story.slice(
          flopIdx,
          turnIdx > flopIdx ? turnIdx : riverIdx > flopIdx ? riverIdx : story.length
        )
      : "";
  const turnText =
    turnIdx >= 0 ? story.slice(turnIdx, riverIdx > turnIdx ? riverIdx : story.length) : "";
  const riverText = riverIdx >= 0 ? story.slice(riverIdx) : "";

  // hero: try lines containing "with" or "holds"
  const heroMatch = story.match(/with\s+([A-Za-z0-9♥♦♣♠ ]+?)\b(?:,|\.)/i) || story.match(/holds?\s+([A-Za-z0-9♥♦♣♠ ]+?)\b(?:,|\.)/i);
  if (heroMatch?.[1]) {
    result.hero = parseMany(heroMatch[1]).slice(0, 2).map(c => tokenFromParsed(c));
  }

  result.flop = parseMany(flopText).slice(0, 3).map(c => tokenFromParsed(c));
  result.turn = parseMany(turnText).slice(0, 1).map(c => tokenFromParsed(c));
  result.river = parseMany(riverText).slice(0, 1).map(c => tokenFromParsed(c));

  return result;
}

// Convert parsed card {r,s} back to canonical token like "Kh" (for display to LLM/user)
function tokenFromParsed(c: { r: number; s: "s"|"h"|"d"|"c" }) {
  const v = c.r;
  const face = v === 14 ? "A" : v === 13 ? "K" : v === 12 ? "Q" : v === 11 ? "J" : v === 10 ? "T" : String(v);
  return face + (c.s === "s" ? "s" : c.s === "h" ? "h" : c.s === "d" ? "d" : "c");
}

/** Build a compact one-liner situation & a GTO-ish baseline without calling an LLM */
function craftStrategy(opts: {
  position?: string;
  stakes?: string;
  heroTokens: string[];
  boardTokens: string[];
  handLabel: string;
  riverFacingBet: boolean | undefined;
}) {
  const { position, stakes, heroTokens, boardTokens, handLabel, riverFacingBet } = opts;

  const pos = position || "Unknown";
  const stk = stakes || "Unknown";
  const boardTxt =
    boardTokens.length > 0 ? boardTokens.join(" ") : "—";
  const heroTxt = heroTokens.length > 0 ? heroTokens.join(" ") : "—";

  // Coarse river logic: facing bet vs. checked to us
  let decision = "CHECK";
  let mixNote = "";
  if (riverFacingBet === true) {
    // by default, bluffcatch with medium strength; raise strong nutted; fold air
    if (/Full House|Four of a Kind|Straight Flush|Flush|Straight/.test(handLabel)) {
      decision = "RAISE (for value)";
      mixNote = " (MIXED: sometimes call to protect raising range).";
    } else if (/Three of a Kind|Two Pair|One Pair/.test(handLabel)) {
      decision = "CALL (bluff-catch)";
      mixNote = " (MIXED: close spots may fold vs large/overbets).";
    } else {
      decision = "FOLD";
      mixNote = " (MIXED: turn your best air into bluff vs capped ranges).";
    }
  } else if (riverFacingBet === false) {
    // checked to us
    if (/Full House|Four of a Kind|Straight Flush|Flush|Straight|Three of a Kind/.test(handLabel)) {
      decision = "BET for value";
      mixNote = " (MIXED: some checks to avoid raises vs stronger).";
    } else if (/Two Pair/.test(handLabel)) {
      decision = "MIXED — bet small for value or check for pot control";
    } else if (/One Pair/.test(handLabel)) {
      decision = "MIXED — lean CHECK with weak kicker; bet small vs worse calls";
    } else {
      decision = "MIXED — BLUFF some % if villain's range looks weak";
    }
  } else {
    // unknown
    decision = "MIXED — depends on river action (bet vs check-through).";
  }

  const strategy =
`DECISION:
- ${decision}${mixNote}

SITUATION:
- SRP, ${pos}, stakes ${stk}.
- Hero: ${heroTxt}.
- Board: ${boardTxt}.
- Hand class: ${handLabel}.

WHY:
- Use value bet vs. worse calls; check to control pot when dominated or to induce.
- Facing a bet: call with medium strength to catch bluffs; raise only with strong value hands.
- Size selection: ~1/3–1/2 pot for thin value; polar larger when nutted or bluffing.`;

  const exploit =
`- Versus opponents who over-bluff rivers, widen your calling range.
- Versus passive opponents, take thinner value bets and avoid bluffing thin air.
- Adjust sizing: smaller vs. wide calling stations, larger vs. capped ranges.`;

  return { strategy, exploit };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const source = pickSource(body);

    // Gather cards
    let heroTokens: string[] = [];
    let flopTokens: string[] = [];
    let turnTokens: string[] = [];
    let riverTokens: string[] = [];

    if (source === "summary" && body.summary?.cards) {
      const c = body.summary.cards;
      heroTokens = safeArr(c.hero);
      flopTokens = safeArr(c.flop);
      turnTokens = safeArr(c.turn);
      riverTokens = safeArr(c.river);
    } else {
      const parsed = parseStoryForCards(body.story);
      heroTokens = parsed.hero;
      flopTokens = parsed.flop;
      turnTokens = parsed.turn;
      riverTokens = parsed.river;
    }

    const boardTokens = safeArr(flopTokens, turnTokens, riverTokens);

    // Evaluate hand class (never throws)
    const evalRes = evaluateHeroAndBoard(heroTokens, boardTokens);
    const handLabel = evalRes.label;

    // Determine if river is facing bet or check-through (best-effort)
    let riverFacingBet: boolean | undefined = undefined;
    const hint = body.summary?.actionHint || body.story || "";
    const hintLower = hint.toLowerCase();
    if (/(river).*(bets?|overbets?)/.test(hintLower) || /facing[-\s]?bet/.test(hintLower)) {
      riverFacingBet = true;
    } else if (/(river).*(checks?).*(checks?|back)/.test(hintLower) || /check[-\s]?through/.test(hintLower)) {
      riverFacingBet = false;
    }

    // Craft strategy (deterministic, no LLM)
    const { strategy, exploit } = craftStrategy({
      position: body.summary?.position,
      stakes: body.summary?.stakes,
      heroTokens,
      boardTokens,
      handLabel,
      riverFacingBet,
    });

    const payload = {
      ok: true,
      sourceUsed: source,
      handLabel,
      hero: heroTokens,
      board: {
        flop: flopTokens,
        turn: turnTokens,
        river: riverTokens,
      },
      riverFacingBet,
      strategy,
      exploit,
      notes:
        boardTokens.length < 5
          ? "Not all board streets present; evaluation based on available cards."
          : undefined,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    // Never break the UI — return a friendly error payload
    return NextResponse.json(
      {
        ok: false,
        strategy:
          "Could not compute strategy due to an unexpected error. Using safe defaults:\n\nDECISION: Mixed. If checked to, check back marginal hands; if facing a bet, call with medium strength and fold air.",
        exploit:
          "Tighten up versus big overbets. Take thinner value versus calling stations.",
        error: String(err?.message || err),
      },
      { status: 200 }
    );
  }
}
