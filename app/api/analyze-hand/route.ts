import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ---------------- small utilities ---------------- */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
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
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ----------- story heuristics (check vs bet on river) ----------- */
function detectRiverFacingCheck(text: string): boolean {
  const s = (text || "").toLowerCase();
  const riverLine = (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || "").toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(text: string): { facing: boolean; large: boolean } {
  const s = (text || "").toLowerCase();
  const riverLine = (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || "").toLowerCase();
  const heroActsFirst = /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)\b/.test(riverLine);
  const facing =
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) && !heroActsFirst && !/\b(checks?|x)\b/.test(riverLine);
  const large = facing && /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(riverLine);
  return { facing, large };
}

/* ----------- light rank parsing (hero + board) ----------- */
type Rank = "A" | "K" | "Q" | "J" | "T" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
const RANKS: Rank[] = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const RANK_VAL: Record<Rank, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

function pickRanksFromCards(str: string): Rank[] {
  // Accepts things like "K♥ T♥" or "kh th" or "Ks Ts", returns ["K","T"]
  const s = (str || "").toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  // Prefer explicit 'cards' field, fallback to raw text "with kh th"/"hero ah jh"
  const fromField = pickRanksFromCards(cardsField || "");
  if (fromField.length >= 2) return fromField.slice(0, 2);

  const m1 = (rawText || "").match(/\b(?:with|holding|has|have)\s+([akqjt2-9hcds♥♦♣♠\s]{2,10})\b/i);
  if (m1) return pickRanksFromCards(m1[1]).slice(0, 2);

  const m2 = (rawText || "").match(/\bhero\s+([akqjt2-9hcds♥♦♣♠\s]{2,10})\b/i);
  if (m2) return pickRanksFromCards(m2[1]).slice(0, 2);

  return [];
}

function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  // board field might contain "Flop: … | Turn: … | River: …"
  const fromField = pickRanksFromCards(boardField || "");
  if (fromField.length) return fromField;

  // Parse story lines (flop/turn/river)
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

/** True if the *board by itself* contains any paired rank */
function isBoardPaired(boardField?: string, rawText?: string): boolean {
  const board = extractBoardRanks(boardField, rawText);
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2);
}

/** Trips-with-weak-kicker = board paired + hero holds exactly one of that rank + other card <= Q */
function computeTripsWeakKickerHint(cardsField?: string, boardField?: string, rawText?: string): boolean {
  const hero = extractHeroRanks(cardsField, rawText);
  const board = extractBoardRanks(boardField, rawText);
  if (hero.length < 2 || board.length < 3) return false;

  const bCounts: Record<string, number> = {};
  for (const r of board) bCounts[r] = (bCounts[r] || 0) + 1;

  const paired = RANKS.filter((r) => (bCounts[r] || 0) >= 2);
  if (!paired.length) return false; // board must actually be paired

  const hCounts: Record<string, number> = {};
  for (const r of hero) hCounts[r] = (hCounts[r] || 0) + 1;

  const tripsRank = paired.find((r) => (hCounts[r] || 0) === 1);
  if (!tripsRank) return false;

  const other = hero.find((r) => r !== tripsRank) as Rank | undefined;
  if (!other) return false;

  return RANK_VAL[other] <= RANK_VAL["Q"]; // weak kicker (Q/J/T/…)
}

/** True when the board is paired but Hero *does not* hold that paired rank (shared pair risk) */
function computePairOnBoardShared(cardsField?: string, boardField?: string, rawText?: string): boolean {
  const hero = extractHeroRanks(cardsField, rawText);
  const board = extractBoardRanks(boardField, rawText);
  if (hero.length < 2 || board.length < 3) return false;

  const bCounts: Record<string, number> = {};
  for (const r of board) bCounts[r] = (bCounts[r] || 0) + 1;

  const pairedOnBoard = Object.keys(bCounts).filter((r) => bCounts[r] >= 2) as Rank[];
  if (!pairedOnBoard.length) return false; // require a real board pair

  const hCounts: Record<string, number> = {};
  for (const r of hero) hCounts[r] = (hCounts[r] || 0) + 1;

  // "shared" only if Hero holds none of the paired rank
  return pairedOnBoard.some((r) => (hCounts[r] || 0) === 0);
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

RIVER GUARDRAILS:
- If HINT board_paired=false, do NOT say the board is paired or talk about shared board pairs.
- If HINT ip_river_facing_check=true and the spot is close, output a MIXED plan with small bet (25–50%) frequency + check frequency, and WHEN to prefer each.
- If HINT river_facing_bet=true and HINT trips_weak_kicker=true (board pair + hero has one of that rank with a non-premium kicker), default to CALL vs sizable bets. Raising is dominated by better value (boats/stronger Kx). Mention exploits only if clear.
- If HINT pair_on_board_shared=true and HAND_CLASS is just "Pair", prefer CHECK or SMALL 20–33% rather than large/polar bets; highlight kicker wars and shared-pair dynamics.

DECISION
- Node: the last street (usually River).
- Action: Call / Fold / Check / Bet / Raise OR "MIXED: ..." with frequencies.
- Include brief reasons; only mention pot odds if they are explicit in the notes.

SITUATION
- SRP/3BP, positions, eff stacks, pot/SPR if given, hero cards (if given).

RANGE SNAPSHOT + per-street summaries
- Sizing family, Value classes, Bluffs/semi-bluffs, Slowdowns/Check-backs, Vs raise rule.

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

    const story = (rawText || notes || "").trim();

    // Hints
    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);
    const boardPaired = isBoardPaired(board, story);
    const tripsWeak = computeTripsWeakKickerHint(cards, board, story);
    const pairOnBoardShared = computePairOnBoardShared(cards, board, story);

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `Hero Cards: ${cards || "(unknown)"}`,
      `Board: ${board || "(unknown)"}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `HINT: board_paired=${boardPaired ? "true" : "false"}`,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? "true" : "false"}`,
      `HINT: river_facing_bet=${riverFacingBet ? "true" : "false"}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? "true" : "false"}` : ``,
      `HINT: trips_weak_kicker=${tripsWeak ? "true" : "false"}`,
      `HINT: pair_on_board_shared=${pairOnBoardShared ? "true" : "false"}`,
      ``,
      `RAW HAND TEXT:`,
      story || "(none provided)",
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
          ", "
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
        ? parsed.learning_tag.filter((t: unknown) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("analyze-hand error:", e?.message || e);
    return NextResponse.json({ error: "Failed to analyze hand" }, { status: 500 });
  }
}
