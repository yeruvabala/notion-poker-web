// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ---------------- small utilities ---------------- */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object") return Object.entries(v).map(([k,val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

/* ----------- story heuristics (river) ----------- */
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
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) &&
    !heroActsFirst &&
    !/\b(checks?|x)\b/.test(riverLine);
  const large = facing && /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(riverLine);
  return { facing, large };
}

/* ----------- rank helpers just for one guard hint ----------- */
type Rank = "A"|"K"|"Q"|"J"|"T"|"9"|"8"|"7"|"6"|"5"|"4"|"3"|"2";
const RANKS: Rank[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const RANK_VAL: Record<Rank, number> = {A:14,K:13,Q:12,J:11,T:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2};

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || "").toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  const a = pickRanksFromCards(boardField || "");
  if (a.length) return a;
  const s = rawText || "";
  const ranks: Rank[] = [];
  const add = (line: string) => pickRanksFromCards(line).forEach(r => ranks.push(r));
  const flop = s.match(/flop[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  const turn = s.match(/turn[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  const river= s.match(/river[^:\n]*[: ]?([^\n]*)/i)?.[1] || "";
  add(flop); add(turn); add(river);
  return ranks;
}

/** Guard-hint: true only when board-pair + hero has exactly one of that rank + kicker <= Q */
function computeTripsWeakKickerHint(heroCards: string, boardField?: string, rawText?: string) {
  const hero = pickRanksFromCards(heroCards);
  const board = extractBoardRanks(boardField, rawText);
  if (hero.length < 2 || board.length < 3) return false;

  const boardCounts: Record<string, number> = {};
  for (const r of board) boardCounts[r] = (boardCounts[r] || 0) + 1;
  const pairedOnBoard = RANKS.filter(r => (boardCounts[r] || 0) >= 2);
  if (!pairedOnBoard.length) return false;

  const heroCounts: Record<string, number> = {};
  for (const r of hero) heroCounts[r] = (heroCounts[r] || 0) + 1;

  const tripsRank = pairedOnBoard.find(r => (heroCounts[r] || 0) === 1);
  if (!tripsRank) return false;

  const other = hero.find(r => r !== tripsRank) as Rank | undefined;
  if (!other) return false;

  return RANK_VAL[other] <= RANK_VAL["Q"]; // Q/J/T/… = “weak” kicker
}

/* ------------------- CASH-only filter ------------------- */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = ["tournament","mtt","icm","players left","final table","bubble","itm","day 1","day 2","level ","bb ante","bba","ante","pay jump","payout"];
  const hits = terms.filter(t => text.includes(t));
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

/* ------------------- SYSTEM PROMPT ------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"]
}

Authoritative inputs:
- HAND_CLASS is computed deterministically by the UI. **Do not contradict it.**
- If HAND_CLASS says "Two Pair", you must not call it "Trips" or "Top pair", etc.
- HERO_CARDS and BOARD are provided as normalized tokens (e.g., "Kh Th" and "Flop: Kd 5h 2s | Turn: Qs | River: Ks").

RIVER RULES (guardrails):
- If HINT ip_river_facing_check=true and the spot is close, output a MIXED plan with small bet (25–50%) frequency + check frequency, and WHEN to prefer each.
- If HINT river_facing_bet=true and HINT trips_weak_kicker=true, default to CALL vs sizable bets. Raising is dominated unless explicit exploits apply.

DECISION
- Node: choose the last street (usually River).
- Action: Call / Fold / Check / Bet / Raise, or "MIXED: ..." with brief frequencies.
- Keep "gto_strategy" ~180–260 words, solver-like, with pot-% sizes (no invented precise equities).

Include short sections in order: DECISION, SITUATION, RANGE SNAPSHOT, RIVER (or current street details), WHY, COMMON MISTAKES, LEARNING TAGS.

Rules:
- CASH only; ignore ICM/players-left.
- Thin-value bets are small; polar lines get big.
- Do NOT narrate what Hero “did.” Give the best play(s) now.
`;

/* ------------------- handler ------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Payload from page (story or summary); all are optional strings
    const {
      date, stakes, position, cards, board = "",
      notes = "", rawText = "", fe_hint, spr_hint,
      hand_class // <-- NEW: authoritative classification coming from the page
    }: {
      date?: string; stakes?: string; position?: string;
      cards?: string; board?: string; notes?: string; rawText?: string;
      fe_hint?: string; spr_hint?: string; hand_class?: string;
    } = body ?? {};

    const story = (rawText || notes || "");

    // Heuristic context flags from story text
    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);

    // Guard-hint: trips with weak kicker (board pair + hero singleton + weak other card)
    const tripsWeak =
      !!cards && computeTripsWeakKickerHint(cards, board, story);

    // Build user message with clean, explicit inputs
    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || "today"}`,
      `Stakes: ${stakes || "(unknown)"}`,
      `Position: ${position || "(unknown)"}`,
      `HERO_CARDS: ${cards || "(unknown)"}`,
      `BOARD: ${board || "(unknown)"}`,
      hand_class ? `HAND_CLASS: ${hand_class}` : `HAND_CLASS: Unknown`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? "true":"false"}`,
      `HINT: river_facing_bet=${riverFacingBet ? "true":"false"}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? "true":"false"}` : ``,
      `HINT: trips_weak_kicker=${tripsWeak ? "true":"false"}`,
      ``,
      `RAW HAND TEXT:`,
      story.trim() || "(none provided)",
      ``,
      `FOCUS: Decide the final-street action in a solver-like way. Respect HAND_CLASS and HINTs above.`
    ].filter(Boolean).join("\n");

    // CASH-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy: `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(", ")}). Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only","mtt-blocked"]
      });
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] }; }

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
