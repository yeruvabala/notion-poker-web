import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ---------------- small utilities ---------------- */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  return String(v);
}

function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament",
    "mtt",
    "icm",
    "players left",
    "final table",
    "bubble",
    "itm",
    "day 1",
    "day 2",
    "level ",
    "bb ante",
    "bba",
    "ante",
    "pay jump",
    "payout",
  ];
  const hits = terms.filter((t) => text.includes(t));
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ----------- story heuristics (check vs bet on river) ----------- */
function detectRiverFacingCheck(text: string): boolean {
  const s = (text || "").toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || "").toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(
  text: string,
): { facing: boolean; large: boolean } {
  const s = (text || "").toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || "").toLowerCase();
  const heroActsFirst =
    /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)/.test(riverLine);
  // If the river line has "bets", "jam", "shove", "pot" etc. without "hero/i" owner,
  // treat as villain bet we are facing.
  const facing =
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) &&
    !heroActsFirst &&
    !/\b(checks?|x)\b/.test(riverLine);
  const large =
    facing &&
    /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(
      riverLine,
    );
  return { facing, large };
}

/* ----------- light rank parsing (hero + board) ----------- */
type Rank = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
const RANKS: Rank[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const RANK_VAL: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2,
};

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || "").toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  // Prefer explicit 'cards' field, fallback to raw text "with kh th" etc.
  const c = pickRanksFromCards(cardsField || "");
  if (c.length >= 2) return c.slice(0, 2);
  const m = (rawText || "").match(/\bwith\s+([akqjt2-9hcds\s]+)\b/i);
  if (m) return pickRanksFromCards(m[1]).slice(0, 2);
  // final fallback: search "hero ah jh"
  const m2 = (rawText || "").match(/\bhero\s+([akqjt2-9hcds\s]{2,10})\b/i);
  if (m2) return pickRanksFromCards(m2[1]).slice(0, 2);
  return [];
}

function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  // board field might contain separate streets; grab all rank letters in order
  const a = pickRanksFromCards(boardField || "");
  if (a.length) return a;
  // From story lines
  const s = rawText || "";
  const ranks: Rank[] = [];
  const add = (line: string) => pickRanksFromCards(line).forEach((r) => ranks.push(r));
  const flop = s.match(/flop[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  const turn = s.match(/turn[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  const river = s.match(/river[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  add(flop);
  add(turn);
  add(river);
  return ranks;
}

/** Board pair + hero has one of that rank with non-premium kicker -> "trips_weak_kicker". */
function hasTripsWeakKicker(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  const paired = RANKS.filter((r) => (counts[r] || 0) >= 2);
  if (!paired.length) return false;
  const heroCounts: Record<string, number> = {};
  for (const r of hero) heroCounts[r] = (heroCounts[r] || 0) + 1;
  const tripsRank = paired.find((r) => (heroCounts[r] || 0) === 1);
  if (!tripsRank) return false;
  const other = hero[0] === tripsRank ? hero[1] : hero[0];
  if (!other) return false;
  // "weak" kicker if <= Q (i.e., NOT Ace). (Ace is strong; K vs K-top board is also fine.)
  return RANK_VAL[other] <= RANK_VAL["Q"];
}

/** If hero has TOP PAIR and the other hole card is an Ace, mark strong kicker. */
function computeStrongKickerTopPair(
  cardsField?: string,
  boardField?: string,
  rawText?: string,
): boolean {
  const hero = extractHeroRanks(cardsField, rawText); // e.g., ["A","Q"]
  const board = extractBoardRanks(boardField, rawText);
  if (hero.length < 2 || board.length < 3) return false;

  // Find highest rank visible on the board (proxy for "top pair" checks).
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    "2",
  );

  // If hero pairs that top board rank, kicker is the *other* card.
  const pairsTop = hero.includes(topBoard);
  if (!pairsTop) return false;
  const other = hero[0] === topBoard ? hero[1] : hero[0];
  return other === "A";
}

/* ------------------- SYSTEM PROMPT ------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"]
}

General style:
- Be prescriptive, concise, solver-like.
- Keep "gto_strategy" ~180–260 words using our section order.
- Use pot-% sizes; avoid fabricated exact equities.

RIVER RULES (guardrails):
- If HINT ip_river_facing_check=true and the spot is close, output a MIXED plan with small bet (25–50%) frequency + check frequency, and WHEN to prefer each.
- If HINT river_facing_bet=true and trips_weak_kicker=true (board pair + hero has one of that rank with a non-premium kicker), **default to CALL** vs sizable bets. Raising is usually dominated (isolation vs better Kx/boats). Only suggest raises with explicit exploit notes or strong blockers; otherwise explain why call > raise.
- If HINT strong_kicker=true, do NOT call the kicker weak; treat it as strong (e.g., top pair with Ace kicker).

DECISION
- Node: pick the last street asked about (usually River).
- Action: Call / Fold / Check / Bet / Raise OR "MIXED: ..." with frequencies if appropriate.
- Include brief reasons; “Pot odds: ~XX%” only if they are explicit.

SITUATION
- SRP/3BP, positions, eff stacks, pot/SPR if given, hero cards (if given).

RANGE SNAPSHOT + per-street summaries
- Sizing family, Value classes, Bluffs/semi-bluffs, Slowdowns/Check-backs, Vs raise rule.
- NEXT CARDS on earlier streets.

WHY + COMMON MISTAKES + LEARNING TAGS
- 2–5 bullets each.

Rules:
- CASH only; ignore ICM/players-left.
- Thin-value bets are small; polar lines get big.
- Do NOT narrate what Hero “did.” Give the best play(s) now.
`;

/* ------------------- handler ------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      board = "",
      notes = "",
      rawText = "",
      fe_hint,
      spr_hint,
    }: {
      date?: string;
      stakes?: string;
      position?: string;
      cards?: string;
      board?: string;
      notes?: string;
      rawText?: string;
      fe_hint?: string;
      spr_hint?: string;
    } = body ?? {};

    const story = rawText || notes || "";

    // Hints
    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);

    const heroRanks = extractHeroRanks(cards, story);
    const boardRanks = extractBoardRanks(board, story);
    const tripsWeak = hasTripsWeakKicker(heroRanks, boardRanks);
    const strongKickerTopPair = computeStrongKickerTopPair(cards, board, story);

    // Compose the user block
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? "true" : "false"}`,
      `HINT: river_facing_bet=${riverFacingBet ? "true" : "false"}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? "true" : "false"}` : ``,
      `HINT: trips_weak_kicker=${tripsWeak ? "true" : "false"}`,
      `HINT: strong_kicker=${strongKickerTopPair ? "true" : "false"}`,
      ``,
      `RAW HAND TEXT:`,
      story.trim() || "(none provided)",
      ``,
      `FOCUS: Decide the final-street action in a solver-like way. Respect HINTs above.`,
    ]
      .filter(Boolean)
      .join("\n");

    // CASH-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy: `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(
          ", ",
        )}). Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
      });
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
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

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter(
            (t: unknown) => typeof t === "string" && t.trim(),
          )
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("analyze-hand error:", e?.message || e);
    return NextResponse.json({ error: "Failed to analyze hand" }, { status: 500 });
  }
}
