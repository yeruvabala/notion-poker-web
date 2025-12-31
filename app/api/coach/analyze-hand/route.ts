export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { transformToAgentInput, runMultiAgentPipeline } from './pipeline';

/**
 * Coach API: Hand Analysis Endpoint
 * 
 * Uses a 7-agent multi-agent pipeline for comprehensive GTO poker analysis.
 * 
 * Pipeline includes:
 * - Agent 0: Board Analysis
 * - Agent 1: Range Building  
 * - Agent 2: Equity Calculation
 * - Agent 3: Advantage Analysis
 * - Agent 4: SPR Calculation
 * - Agent 5: GTO Strategy (with Anti-Bias Protocol & Mixed Strategies)
 * - Agent 6: Mistake Detection (3-Tier Classification)
 * - Returns { gto_strategy, exploit_deviation, learning_tag }
 *
 * IMPORTANT:
 * For batch enrichment we DO NOT block tournaments.
 * We always treat the spot as a cash-game style analysis.
 */

/* ---------------- tiny helpers reused from your analyzer ---------------- */
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join('\n');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join('\n');
  }
  return String(v);
}

function detectRiverFacingCheck(text: string): boolean {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(text: string): { facing: boolean; large: boolean } {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const heroActsFirst =
    /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)/.test(riverLine);
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

/* ---- very light card/board rank extraction (same shape your analyzer uses) ---- */
type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_VAL: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  9: 9,
  8: 8,
  7: 7,
  6: 6,
  5: 5,
  4: 4,
  3: 3,
  2: 2,
};

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || '').toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  const c = pickRanksFromCards(cardsField || '');
  if (c.length >= 2) return c.slice(0, 2) as Rank[];
  // try to guess from text like "Ah Kh"
  const m = (rawText || '').match(
    /\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b.*?\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b/i,
  );
  if (m) return pickRanksFromCards(`${m[1]}${m[2]}`).slice(0, 2) as Rank[];
  return [];
}

// uses one-arg helper closing over `ranks`
function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  const ranks: Rank[] = [];

  const add = (src: string) => {
    const r = pickRanksFromCards(src);
    for (const x of r) {
      if (ranks.length < 5) ranks.push(x);
    }
  };

  add(boardField || '');

  const s = (rawText || '').toUpperCase();
  const flop = s.match(/\bFLOP[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const turn = s.match(/\bTURN[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const river = s.match(/\bRIVER[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';

  add(flop);
  add(turn);
  add(river);

  return ranks;
}

function isBoardPaired(board: Rank[]): boolean {
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2);
}
function isHeroTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  return hero.includes(topBoard);
}
function hasTripsWeakKicker(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const counts: Record<string, number> = {};
  for (const r of [...hero, ...board]) counts[r] = (counts[r] || 0) + 1;
  const low = hero.find((r) => RANK_VAL[r] <= 9);
  return Object.values(counts).some((n) => n >= 3) && !!low;
}
function computeStrongKickerTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  const other = hero.find((r) => r !== topBoard);
  return hero.includes(topBoard) && !!other && RANK_VAL[other] >= 11; // J+
}


/* --------------------------------- HANDLER --------------------------------- */
export async function POST(req: Request) {
  try {
    // Shared-secret auth
    const token = req.headers.get('x-app-token');
    if (!process.env.COACH_API_TOKEN || token !== process.env.COACH_API_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept either { raw_text } or richer fields
    const body = await req.json().catch(() => ({} as any));
    const story: string = asText(body?.raw_text || body?.text || '');

    if (!story.trim()) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    // Check for pre-parsed data from coach_worker (more accurate than extracting from text)
    const preParsed = body?.parsed || {};

    const date = asText(body?.date || '');
    // Use preParsed values if available, otherwise fall back to body fields, then empty
    const stakes = asText(preParsed?.stakes || body?.stakes || '');
    const position = asText(preParsed?.position || body?.position || '');
    const cards = asText(preParsed?.cards || body?.cards || '');
    const board = asText(preParsed?.board || body?.board || '');
    const spr_hint = asText(body?.spr_hint || '');
    const fe_hint = asText(body?.fe_hint || '');

    // Extract pot type info from preParsed data (for accurate 3bet/4bet detection)
    const potType = preParsed?.pot_type || '';
    const preflopRaises = preParsed?.preflop_raises || 0;

    // Hints
    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);

    const heroRanks = extractHeroRanks(cards, story);
    const boardRanks = extractBoardRanks(board, story);

    const boardPaired = isBoardPaired(boardRanks);
    const heroTopPair = isHeroTopPair(heroRanks, boardRanks);
    const tripsWeak = hasTripsWeakKicker(heroRanks, boardRanks);
    const strongKickerTopPair = computeStrongKickerTopPair(heroRanks, boardRanks);

    const facts = [
      `Hero ranks: ${heroRanks.join(',') || '(unknown)'}`,
      `Board ranks: ${boardRanks.join(',') || '(unknown)'}`,
      `board_paired=${boardPaired}`,
      `hero_top_pair=${heroTopPair}`,
      `trips_weak_kicker=${tripsWeak}`,
      `strong_kicker=${strongKickerTopPair}`,
    ].join(' | ');

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || 'today'}`,
      `Stakes: ${stakes || '(unknown)'}`,
      `Position: ${position || '(unknown)'}`,
      `Hero Cards: ${cards || '(unknown)'}`,
      `Board: ${board || '(unknown)'}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      // Pot type hints for accurate range analysis
      potType ? `HINT: pot_type=${potType}` : ``,
      preflopRaises ? `HINT: preflop_raises=${preflopRaises}` : ``,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? 'true' : 'false'}`,
      `HINT: river_facing_bet=${riverFacingBet ? 'true' : 'false'}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? 'true' : 'false'}` : ``,
      `HINT: board_paired=${boardPaired ? 'true' : 'false'}`,
      `HINT: hero_top_pair=${heroTopPair ? 'true' : 'false'}`,
      `HINT: trips_weak_kicker=${tripsWeak ? 'true' : 'false'}`,
      `HINT: strong_kicker=${strongKickerTopPair ? 'true' : 'false'}`,
      ``,
      `FACTS: ${facts}`,
      ``,
      `RAW HAND TEXT:`,
      story.trim() || '(none provided)',
      ``,
      `FOCUS: Analyze ALL streets sequentially (preflop, flop, turn, river) in a solver-like way. Treat this as a cash-game spot and ignore ICM.`,
    ]
      .filter(Boolean)
      .join('\n');

    // 🔴 IMPORTANT: NO MTT BLOCK HERE.
    // Even if the hand looks like a tournament, we still analyze it as a cash-game spot.

    // ═══════════════════════════════════════════════════════════════
    // MULTI-AGENT PIPELINE (ONLY METHOD - No Fallback)
    // ═══════════════════════════════════════════════════════════════
    console.log('[route.ts] Using multi-agent pipeline...');

    // Transform incoming data to agent input format
    const pipelineInput = transformToAgentInput(body);

    // Run the 7-agent pipeline
    const pipelineResult = await runMultiAgentPipeline(pipelineInput);

    console.log('[route.ts] ✅ Pipeline completed successfully');

    // Phase 12-14.5: Return enhanced coaching data for UI
    return NextResponse.json({
      gto_strategy: pipelineResult.gto_strategy,
      exploit_deviation: pipelineResult.exploit_deviation,
      learning_tag: pipelineResult.learning_tag,
      hero_position: pipelineInput.positions?.hero || null,
      structured_data: pipelineResult.structured_data,
      // Phase 12-14.5: Enhanced data for rich UI tooltips
      hero_classification: pipelineResult.heroClassification || null,
      spr_analysis: pipelineResult.spr || null,
      mistake_analysis: pipelineResult.mistakes || null
    });

  } catch (e: any) {
    console.error('❌ [Coach API] PIPELINE ERROR:', e?.message || e);
    console.error('Stack:', e?.stack);
    return NextResponse.json({
      error: 'Pipeline failed',
      details: e?.message,
      stack: e?.stack
    }, { status: 500 });
  }
}
