// app/api/analyze-hand/route.ts
import { NextRequest, NextResponse } from "next/server";
import { evaluateHeroAndBoard, parseMany } from "@/app/lib/poker-eval";

/** ---------- Request shapes your UI may send ---------- */

type SummaryCards = {
  hero?: string[]; // e.g. ["Kh","Th"] or ["K♥","T♥"]
  flop?: string[]; // up to 3
  turn?: string[]; // up to 1
  river?: string[]; // up to 1
};

type SummaryEditors = {
  position?: string;   // BTN / CO / SB / BB / UTG / etc
  stakes?: string;     // "1/3"
  actionHint?: string; // "river: facing-bet" | "river: check-through" (optional)
  cards?: SummaryCards;
};

type Body = {
  story?: string;                     // free-text story (optional)
  summary?: SummaryEditors;           // summary editors payload (optional)
  source?: "summary" | "story" | "auto"; // who should we trust
  // LEGACY fallbacks the older UI might still send:
  heroCards?: string[];               // ["Kh","Th"]
  board?: { flop?: string[]; turn?: string[]; river?: string[] };
};

/** ---------- Helpers ---------- */

const safeArr = (...chunks: (string[] | undefined | null)[]) =>
  chunks.flatMap((x) => (Array.isArray(x) ? x.filter(Boolean) : []));

function pickSource(body: Body): "summary" | "story" {
  if (body.source === "summary") return "summary";
  if (body.source === "story") return "story";
  const anySummary =
    !!body.summary?.cards?.hero?.length ||
    !!body.summary?.cards?.flop?.length ||
    !!body.summary?.cards?.turn?.length ||
    !!body.summary?.cards?.river?.length;
  return anySummary ? "summary" : "story";
}

function tokenFromParsed(c: { r: number; s: "s"|"h"|"d"|"c" }) {
  const v = c.r;
  const rank = v === 14 ? "A" : v === 13 ? "K" : v === 12 ? "Q" : v === 11 ? "J" : v === 10 ? "T" : String(v);
  const suit = c.s;
  return rank + suit; // "Kh", "As", etc.
}

/** very light story parsing so route never returns empty */
function parseStory(story?: string) {
  const out = { hero: [] as string[], flop: [] as string[], turn: [] as string[], river: [] as string[] };
  if (!story) return out;

  const flopIdx = story.toLowerCase().indexOf("flop");
  const turnIdx = story.toLowerCase().indexOf("turn");
  const riverIdx = story.toLowerCase().indexOf("river");

  const flopSlice =
    flopIdx >= 0
      ? story.slice(
          flopIdx,
          turnIdx > flopIdx ? turnIdx : riverIdx > flopIdx ? riverIdx : story.length
        )
      : "";
  const turnSlice =
    turnIdx >= 0 ? story.slice(turnIdx, riverIdx > turnIdx ? riverIdx : story.length) : "";
  const riverSlice = riverIdx >= 0 ? story.slice(riverIdx) : "";

  // try to pull hero from “with …” or “holds …”
  const heroMatch =
    story.match(/with\s+([A-Za-z0-9♥♦♣♠ ]+?)\b(?:,|\.)/i) ||
    story.match(/holds?\s+([A-Za-z0-9♥♦♣♠ ]+?)\b(?:,|\.)/i);
  if (heroMatch?.[1]) {
    out.hero = parseMany(heroMatch[1]).slice(0, 2).map(tokenFromParsed);
  }
  out.flop = parseMany(flopSlice).slice(0, 3).map(tokenFromParsed);
  out.turn = parseMany(turnSlice).slice(0, 1).map(tokenFromParsed);
  out.river = parseMany(riverSlice).slice(0, 1).map(tokenFromParsed);
  return out;
}

function craftStrategy(opts: {
  position?: string;
  stakes?: string;
  heroTokens: string[];
  boardTokens: string[];
  handLabel: string;
  riverFacingBet?: boolean;
}) {
  const { position, stakes, heroTokens, boardTokens, handLabel, riverFacingBet } = opts;
  const pos = position || "Unknown";
  const stk = stakes || "Unknown";

  let decision = "CHECK";
  let mix = "";

  if (riverFacingBet === true) {
    if (/Full House|Four of a Kind|Straight Flush|Flush|Straight/.test(handLabel)) {
      decision = "RAISE (value)";
      mix = " (MIXED: some calls to protect).";
    } else if (/Three of a Kind|Two Pair|One Pair/.test(handLabel)) {
      decision = "CALL (bluff-catch)";
      mix = " (MIXED: fold vs huge polar sizing with weak kickers).";
    } else {
      decision = "FOLD";
      mix = " (MIXED: bluff raise occasionally vs capped ranges).";
    }
  } else if (riverFacingBet === false) {
    if (/Full House|Four of a Kind|Straight Flush|Flush|Straight|Three of a Kind/.test(handLabel)) {
      decision = "BET (value)";
      mix = " (MIXED: some checks to avoid XR).";
    } else if (/Two Pair/.test(handLabel)) {
      decision = "MIXED — small value bet or check for pot control";
    } else if (/One Pair/.test(handLabel)) {
      decision = "MIXED — often CHECK; thin bet vs worse calls";
    } else {
      decision = "MIXED — BLUFF some % if villain looks capped";
    }
  } else {
    decision = "MIXED — depends on river action (bet vs check-through).";
  }

  const strategy =
`DECISION:
- ${decision}${mix}

SITUATION:
- SRP, ${pos}, stakes ${stk}.
- Hero: ${heroTokens.join(" ") || "—"}
- Board: ${boardTokens.join(" ") || "—"}
- Hand class: ${handLabel}

WHY:
- Value bet when dominated hands call; check to control pot or induce.
- Facing a bet: call mid-strength vs polar ranges; raise only strong/nutted.
- Size: ~33–50% for thin value; polar big when nutted or bluffing.`;

  const exploit =
`- Call wider vs over-bluffers; bet thinner vs calling stations.
- Fold more vs huge overbets from nits; attack capped ranges with raises.`;

  return { strategy, exploit };
}

/** ---------- Route ---------- */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    // Pull cards from Summary, legacy, or Story
    let hero: string[] = [];
    let flop: string[] = [];
    let turn: string[] = [];
    let river: string[] = [];

    const source = pickSource(body);

    if (source === "summary" && body.summary?.cards) {
      hero = safeArr(body.summary.cards.hero);
      flop = safeArr(body.summary.cards.flop);
      turn = safeArr(body.summary.cards.turn);
      river = safeArr(body.summary.cards.river);
    } else if (body.heroCards || body.board) {
      // LEGACY
      hero = safeArr(body.heroCards);
      flop = safeArr(body.board?.flop);
      turn = safeArr(body.board?.turn);
      river = safeArr(body.board?.river);
    } else {
      // Story
      const p = parseStory(body.story);
      hero = p.hero;
      flop = p.flop;
      turn = p.turn;
      river = p.river;
    }

    const board = safeArr(flop, turn, river);

    // Evaluate hand (robust — never throws)
    const evalRes = evaluateHeroAndBoard(hero, board);

    // Detect simple river context
    let riverFacingBet: boolean | undefined = undefined;
    const actionStr = (body.summary?.actionHint || body.story || "").toLowerCase();
    if (/(river).*(bets?|overbets?)/.test(actionStr) || /facing[-\s]?bet/.test(actionStr)) {
      riverFacingBet = true;
    } else if (/(river).*(checks?).*(back|through)/.test(actionStr) || /check[-\s]?through/.test(actionStr)) {
      riverFacingBet = false;
    }

    const { strategy, exploit } = craftStrategy({
      position: body.summary?.position,
      stakes: body.summary?.stakes,
      heroTokens: hero,
      boardTokens: board,
      handLabel: evalRes.label,
      riverFacingBet,
    });

    // ---- IMPORTANT: include legacy keys so the UI shows the text even if it expects "text" ----
    const res = {
      ok: true,
      sourceUsed: source,
      handLabel: evalRes.label,
      hero,
      board: { flop, turn, river },
      riverFacingBet,
      strategy,             // new
      gtoStrategy: strategy, // legacy alias
      text: strategy,         // legacy alias some UIs show directly
      exploit,
      notes:
        board.length < 5
          ? "Not all board streets present; evaluation based on available cards."
          : undefined,
    };

    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        strategy:
          "Fallback: Mixed plan. If checked to, check back marginal hands; if facing a bet, call with medium strength and fold air.",
        gtoStrategy:
          "Fallback: Mixed plan. If checked to, check back marginal hands; if facing a bet, call with medium strength and fold air.",
        text:
          "Fallback: Mixed plan. If checked to, check back marginal hands; if facing a bet, call with medium strength and fold air.",
        exploit:
          "Tighten vs big overbets from nits; value-bet thinner vs callers.",
        error: String(err?.message || err),
      },
      { status: 200 }
    );
  }
}
