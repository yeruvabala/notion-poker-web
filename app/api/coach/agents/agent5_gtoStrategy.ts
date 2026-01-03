/**
 * Agent 5: GTO Strategy Generator (MIXED STRATEGY VERSION)
 * 
 * PURPOSE: Generate optimal GTO strategy with PRIMARY + ALTERNATIVE actions
 * 
 * Now supports GTO mixed strategies where multiple actions are valid:
 * - Primary: The highest frequency action (50%+)
 * - Alternative: Secondary action that's also GTO-approved (10-49%)
 * 
 * RUNS: Tier 4 (after all context agents)
 * MODEL: GPT-4o
 */

import OpenAI from 'openai';
import {
    Agent5Input,
    GTOStrategy,
    StreetDecisionTree,
    MixedActionRecommendation,
    ActionRecommendation,
    RangeInfo
} from '../types/agentContracts';
import { getHandType } from '../utils/handUtils';
import { evaluateHand } from '../utils/handEvaluator';
import { getPreflopAction, getOpeningAction, getVs3BetAction, normalizeHand } from '../utils/gtoRanges';
import { generatePreflopReasoning } from '../utils/PreflopReasoningEngine';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function getOpenAI(): OpenAI {
    return openai;
}

/**
 * Determine who acts first on postflop streets based on position
 * OOP (Out of Position) = SB/BB → Acts first postflop
 * IP (In Position) = BTN/CO/HJ/etc → Acts second postflop (villain acts first)
 */
function determineActingOrder(heroPosition: string): 'hero_first' | 'villain_first' {
    const OOP_POSITIONS = ['SB', 'BB'];  // Out of position
    const IP_POSITIONS = ['BTN', 'CO', 'HJ', 'MP', 'UTG', 'UTG+1', 'LJ'];  // In position

    if (OOP_POSITIONS.includes(heroPosition.toUpperCase())) {
        return 'hero_first';  // Hero acts first postflop
    }

    return 'villain_first';  // Hero is IP, villain acts first postflop
}

// System prompt with MIXED STRATEGY support AND ANTI-BIAS PROTOCOL
const GTO_STRATEGY_PROMPT = `You are a GTO poker strategy expert. Generate optimal strategy with PRIMARY and ALTERNATIVE options.

CRITICAL: GTO often involves MIXED strategies where multiple actions are valid. For each decision point:
- **primary**: The most frequent GTO action (50%+ of the time)
- **alternative**: A secondary action that's also GTO-approved (10-49% of time) - OPTIONAL

DATA-DRIVEN DECISION PROTOCOL (STRICT):
1. **EQUITY vs ODDS**:
   - IF Equity > Pot Odds: You MUST lean towards Call (or Raise for value).
   - IF Equity < Pot Odds: You MUST lean towards Fold (unless implied odds or bluffing are valid).
2. **NUT ADVANTAGE**:
   - IF Hero has Clear Nut Advantage (e.g. "Hero has 3x more Sets"): Favor Overbets and aggressive Raises.
   - IF Villain has Nut Advantage: Favor Checking/Calling (Pot Control).
3. **RANGE STATS**:
   - Use the "STATS" provided in the Ranges section.
   - IF "Hero has 15% Monsters" vs "Villain 2% Monsters": This confirms Nut Advantage. Use it.

ANTI-BIAS PROTOCOL:
You are analyzing a played hand. The Hand Log contains what ACTUALLY happened, but your job is to define what SHOULD have happened.
1. DO NOT be influenced by Hero's actual actions. Frequent tendency is to "justify" the played line. AVOID THIS.
2. If Hero made a mathematically poor play (e.g., limp-calling with trash), your strategy MUST reflect the GTO move (Fold), not the actual move.
3. Treat the Hand Log as a "scenario description" up to the decision point, then IGNORE the specific Hero action when calculating the strategy frequencies.

[POSITION_SPECIFIC_INSTRUCTIONS]

GTO BETTING PRINCIPLES:
- Bet for value when equity > 50% vs calling range
- Check for pot control with medium strength hands
- When FACING a bet: Call if equity > pot odds needed

MIXED STRATEGY EXAMPLES:
- With top pair good kicker: primary = bet (60%), alternative = check (40%)
- Facing river bet with medium hand: primary = call (55%), alternative = fold (45%)
- Drawing hand: primary = check (70%), alternative = bet semi-bluff (30%)

[JSON_FORMAT_EXAMPLE]

RULES:
1. ALWAYS include primary for each decision point
2. Include alternative ONLY when GTO truly has a mixed strategy (10%+ frequency)
3. If pure strategy (one action is 90%+), don't include alternative
4. Frequencies should add up to ~1.0 between primary and alternative
5. Use specific equity and pot odds in reasoning`;

/**
 * Format context for the prompt
 */
function formatContextForPrompt(input: Agent5Input): string {
    const lines: string[] = [];

    // ADD: Situation overview with positions - respects action order (Option B)
    lines.push('SITUATION:');

    // Check villain context to determine if this is an opening scenario
    const villainContext = input.villainContext;

    if (villainContext?.type === 'opening') {
        // Hero was first to act - no specific villain at decision time
        const heroPos = input.positions?.hero?.toUpperCase() || '';

        lines.push(`Hero: ${input.positions?.hero || 'Unknown'} with ${input.heroHand}`);
        lines.push(`Decision Type: OPENING (Hero first to act - evaluate against opening range chart)`);
        lines.push(`Villain: N/A (no action before Hero's decision)`);
        lines.push('');
        lines.push('CRITICAL OPENING RANGE INSTRUCTIONS:');
        lines.push('- This is a preflop OPENING decision - Hero acts first with no prior action');
        lines.push('- DO NOT mention any specific villain position (BTN, CO, etc.) in your reasoning');

        // Add EXPLICIT positional context based on Hero's position
        if (['BTN', 'CO', 'HJ'].includes(heroPos)) {
            lines.push(`- POSITION CONTEXT: Hero is IN POSITION against the blinds (${heroPos} acts AFTER SB/BB on postflop streets)`);
            lines.push('- DO NOT say "out of position" - Hero has positional advantage when opening from late position');
        } else if (['UTG', 'UTG+1', 'UTG+2', 'LJ'].includes(heroPos)) {
            lines.push(`- POSITION CONTEXT: Hero is opening from early position (${heroPos}) - tighter range needed`);
            lines.push('- Focus on hand strength, not positional disadvantage');
        } else if (heroPos === 'SB') {
            lines.push('- POSITION CONTEXT: Hero is in SB (blind steal/limp scenario vs BB)');
        }

        lines.push('- Evaluate based on: opening range chart for Hero\'s position, hand strength, and typical calling ranges from later positions/blinds');
        lines.push('- Use phrases like "against typical calling ranges" NOT specific positions');
    } else if (villainContext?.type === 'sb_vs_bb') {
        // SB vs BB scenario
        lines.push(`Hero: ${input.positions?.hero || 'Unknown'} with ${input.heroHand}`);
        lines.push(`Villain: BB`);
        lines.push(`Decision Type: SB vs BB (blind vs blind)`);
    } else {
        // Hero faced action - use villain as normal
        lines.push(`Hero: ${input.positions?.hero || 'Unknown'} with ${input.heroHand}`);
        lines.push(`Villain: ${input.positions?.villain || 'Unknown'}`);
    }

    // Determine and explicitly state position advantage
    // SKIP for opening scenarios - no specific villain to compare against
    let positionAdvantage = '';

    if (villainContext?.type === 'opening') {
        // For opening scenarios, don't add position advantage line
        // The CRITICAL OPENING RANGE INSTRUCTIONS already covers this
    } else {
        const heroPos = input.positions?.hero?.toUpperCase() || '';
        const villainPos = input.positions?.villain?.toUpperCase() || '';
        const blinds = ['SB', 'BB'];
        const heroIsBlind = blinds.includes(heroPos);
        const villainIsBlind = blinds.includes(villainPos);

        // Hero is IN POSITION if villain is a blind or if hero acts after villain
        // Hero is OUT OF POSITION if hero is a blind vs non-blind
        if (heroIsBlind && !villainIsBlind) {
            positionAdvantage = 'Hero is OUT OF POSITION (blind vs non-blind)';
        } else if (!heroIsBlind && villainIsBlind) {
            positionAdvantage = 'Hero is IN POSITION (non-blind vs blind)';
        } else if (heroPos === 'BTN') {
            positionAdvantage = 'Hero is IN POSITION (BTN has position postflop)';
        } else if (villainPos === 'BTN') {
            positionAdvantage = 'Hero is OUT OF POSITION (vs BTN)';
        } else {
            positionAdvantage = 'Position relative';
        }

        lines.push(`CRITICAL: ${positionAdvantage}`);
    }

    lines.push('');

    // ═══════════════════════════════════════════════════════════
    // NEW: Deterministic Hand Evaluation (Anti-Hallucination)
    // Evaluate per-street for accuracy
    // ═══════════════════════════════════════════════════════════

    // Evaluate hand strength for each street separately
    const flopCards = input.boardAnalysis?.flop?.cards || '';
    const turnCard = input.boardAnalysis?.turn?.card || '';
    const riverCard = input.boardAnalysis?.river?.card || '';

    // Flop evaluation (hero hand + flop only)
    const flopEval = flopCards ? evaluateHand(input.heroHand, flopCards) : null;

    // Turn evaluation (hero hand + flop + turn)
    const turnBoard = flopCards && turnCard ? `${flopCards} ${turnCard}`.trim() : '';
    const turnEval = turnBoard ? evaluateHand(input.heroHand, turnBoard) : null;

    // River evaluation (hero hand + flop + turn + river)
    const riverBoard = turnBoard && riverCard ? `${turnBoard} ${riverCard}`.trim() : '';
    const riverEval = riverBoard ? evaluateHand(input.heroHand, riverBoard) : null;

    // Format verified hand strength per street
    if (flopEval) {
        lines.push('VERIFIED HAND STRENGTH ON FLOP:');
        lines.push(`- Current Strength: ${flopEval.made_hand}`);
        if (flopEval.draws.length > 0) {
            lines.push(`- Draws: ${flopEval.draws.join(', ')}`);
            lines.push(`- Outs: ~${flopEval.outs}`);
        } else {
            lines.push(`- Draws: NONE`);
        }
        if (flopEval.backdoor_draws && flopEval.backdoor_draws.length > 0) {
            lines.push(`- Backdoor Potential: ${flopEval.backdoor_draws.join(', ')}`);
        }
        lines.push('');
    }

    if (turnEval) {
        lines.push('VERIFIED HAND STRENGTH ON TURN:');
        lines.push(`- Current Strength: ${turnEval.made_hand}`);
        if (turnEval.draws.length > 0) {
            lines.push(`- Draws: ${turnEval.draws.join(', ')}`);
            lines.push(`- Outs: ~${turnEval.outs}`);
        } else {
            lines.push(`- Draws: NONE`);
        }
        if (turnEval.backdoor_draws && turnEval.backdoor_draws.length > 0) {
            lines.push(`- Backdoor Potential: ${turnEval.backdoor_draws.join(', ')}`);
        }
        lines.push('');
    }

    if (riverEval) {
        lines.push('VERIFIED HAND STRENGTH ON RIVER:');
        lines.push(`- Final Strength: ${riverEval.made_hand}`);
        lines.push('');
    }

    lines.push('CRITICAL: You MUST use the verified strength FOR EACH STREET. Do NOT use turn/river strength when analyzing flop. Do NOT invent draws.');
    // ═══════════════════════════════════════════════════════════

    // ADD: Action history (Renamed to reduce bias)
    if (input.actions && input.actions.length > 0) {
        lines.push('HAND LOG (CONTEXT ONLY):');
        let currentStreet = '';
        for (const action of input.actions) {
            if (action.street !== currentStreet) {
                currentStreet = action.street;
                lines.push(`  ${currentStreet.toUpperCase()}:`);
            }
            const amountStr = action.amount ? ` $${action.amount}` : '';
            lines.push(`    ${action.player}: ${action.action}${amountStr}`);
        }
        lines.push('[END OF LOG - PLEASE ANALYZE EACH STREET INDEPENDENTLY]');
        lines.push('');
    }

    const handType = getHandType(input.heroHand);
    lines.push(`HERO'S HAND: ${input.heroHand} ${handType}`);
    lines.push('');

    // Board analysis
    lines.push('BOARD ANALYSIS:');
    if (input.boardAnalysis.flop) {
        lines.push(`Flop: ${input.boardAnalysis.flop.cards} - ${input.boardAnalysis.flop.texture}`);
        if (input.boardAnalysis.flop.draws_possible?.length > 0) {
            lines.push(`  Draws: ${input.boardAnalysis.flop.draws_possible.join(', ')}`);
        }
    }
    if (input.boardAnalysis.turn) {
        lines.push(`Turn: ${input.boardAnalysis.turn.card} - ${input.boardAnalysis.turn.impact}`);
    }
    if (input.boardAnalysis.river) {
        lines.push(`River: ${input.boardAnalysis.river.card} - ${input.boardAnalysis.river.impact}`);
    }
    lines.push('');

    // Phase 4: Hand Classification (2D Bucketing) - tells LLM exactly what Hero has
    if (input.heroClassification) {
        lines.push('HAND STRENGTH (Code-Verified - DO NOT Re-Analyze):');
        lines.push(`  Tier: ${input.heroClassification.tier} (${input.heroClassification.description})`);
        lines.push(`  Percentile: ${input.heroClassification.percentile}`);
        lines.push(`  2D Bucket: ${input.heroClassification.bucket2D}`);
        lines.push('');
        lines.push('CRITICAL: Use the HAND STRENGTH above. Do not guess or re-calculate.');
        lines.push('');
    }


    // Helper to format range with rigorous stats
    const formatRangeWithStats = (range: string | RangeInfo | undefined): string => {
        if (!range) return 'Unknown';
        if (typeof range === 'string') return range;

        // It is a RangeInfo object
        let base = `${range.description}`;
        if (range.spectrum) base += ` (${range.spectrum})`;

        // Inject stats if available (Phase 7)
        if (range.stats) {
            const d = range.stats.distribution;
            base += `\n      STATS: Monster ${d.monster.toFixed(1)}%, Strong ${d.strong.toFixed(1)}%, Air ${d.air.toFixed(1)}%`;
            base += `\n      TOP HANDS: ${range.stats.topHands.slice(0, 5).join(', ')}`;
        }
        return base;
    };

    // Ranges
    lines.push('RANGES (Data-Driven Context):');
    lines.push(`Preflop - Hero: ${formatRangeWithStats(input.ranges.preflop.hero_range)}`);
    lines.push(`Preflop - Villain: ${formatRangeWithStats(input.ranges.preflop.villain_range)}`);

    if (input.ranges.flop) {
        lines.push(`Flop - Hero: ${formatRangeWithStats(input.ranges.flop.hero_range)}`);
        lines.push(`Flop - Villain: ${formatRangeWithStats(input.ranges.flop.villain_range)}`);
    }
    if (input.ranges.turn) {
        lines.push(`Turn - Hero: ${formatRangeWithStats(input.ranges.turn.hero_range)}`);
        lines.push(`Turn - Villain: ${formatRangeWithStats(input.ranges.turn.villain_range)}`);
    }
    if (input.ranges.river) {
        lines.push(`River - Villain: ${formatRangeWithStats(input.ranges.river.villain_range)}`);
    }
    lines.push('');

    // Equity
    lines.push('EQUITY & ODDS (Exact Math - use this!)');
    lines.push(`- Pot Odds to Call: ${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%`);
    lines.push(`- Hero Equity vs Range: ${(input.equity.equity_vs_range * 100).toFixed(1)}%`);

    // Phase 10: Split Equity Injection
    if (input.equity.equity_vs_value !== undefined && input.equity.equity_vs_bluffs !== undefined) {
        lines.push(`- Equity vs VALUE hands: ${(input.equity.equity_vs_value * 100).toFixed(1)}%`);
        lines.push(`- Equity vs BLUFFS hands: ${(input.equity.equity_vs_bluffs * 100).toFixed(1)}%`);
        lines.push(`- STRATEGY IMPLICATION: If Villain is value-heavy -> Equity is ~${(input.equity.equity_vs_value * 100).toFixed(0)}%. If bluff-heavy -> Equity is ~${(input.equity.equity_vs_bluffs * 100).toFixed(0)}%.`);
    }

    const diff = input.equity.equity_vs_range - input.equity.pot_odds.equity_needed;
    if (diff > 0.05) {
        lines.push(`- MATH SAYS: POSITIVE (+EV). Equity (${(input.equity.equity_vs_range * 100).toFixed(1)}%) is significantly higher than Odds (${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%). Call is mathematically correct.`);
    } else if (diff < -0.05) {
        lines.push(`- MATH SAYS: NEGATIVE (-EV). Equity (${(input.equity.equity_vs_range * 100).toFixed(1)}%) is lower than Odds (${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%). Fold is mathematically correct (unless implied odds exist).`);
    } else {
        lines.push(`- MATH SAYS: BORDERLINE (Neutral EV). Equity is close to Odds.`);
    }

    if (input.equity.breakdown) {
        lines.push(`Beats: ${input.equity.breakdown.beats?.join(', ') || 'N/A'}`);
        lines.push(`Loses to: ${input.equity.breakdown.loses_to?.join(', ') || 'N/A'}`);
    }
    lines.push('');

    // Advantages
    lines.push('ADVANTAGES (Strategic Drivers):');
    if (input.advantages.flop) {
        const ra = input.advantages.flop.range_advantage;
        const na = input.advantages.flop.nut_advantage;
        lines.push(`Flop Range Advantage: ${ra.leader.toUpperCase()} (${ra.percentage}) - ${ra.reason}`);
        lines.push(`Flop Nut Advantage: ${na.leader.toUpperCase()} - ${na.reason}`);
    }
    if (input.advantages.turn?.shift) {
        lines.push(`Turn shift: ${input.advantages.turn.shift}`);
    }
    if (input.advantages.blocker_effects) {
        lines.push(`Blockers: ${input.advantages.blocker_effects.hero_blocks?.join(', ') || 'None'}`);
    }
    lines.push('');

    // SPR
    lines.push('SPR:');
    if (input.spr.flop_spr !== undefined) {
        lines.push(`Flop SPR: ${input.spr.flop_spr.toFixed(1)}`);
    }
    if (input.spr.turn_spr !== undefined) {
        lines.push(`Turn SPR: ${input.spr.turn_spr.toFixed(1)}`);
    }
    if (input.spr.river_spr !== undefined) {
        lines.push(`River SPR: ${input.spr.river_spr.toFixed(1)}`);
    }
    lines.push('');

    // ═══════════════════════════════════════════════════════════
    // 🎯 PHASE 15: STRATEGIC CONTEXT SYNTHESIS
    // ═══════════════════════════════════════════════════════════

    lines.push('═══════════════════════════════════════════════════');
    lines.push('🎯 STRATEGIC CONTEXT SYNTHESIS (Phase 15)');
    lines.push('Use this to provide EDUCATIONAL, CONTEXTUAL advice');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');

    // Build strategic insights from all context
    const strategicInsights: string[] = [];

    // 1. Hand Strength + Range Position
    if (input.heroClassification) {
        const tier = input.heroClassification.tier || 'UNKNOWN';
        const percentile = input.heroClassification.percentile || '';
        strategicInsights.push(`HAND STRENGTH: ${tier} (${percentile})`);

        if (tier === 'MONSTER' || tier === 'STRONG') {
            strategicInsights.push('→ STRONG HAND: Bet for value,  can commit stack');
        } else if (tier === 'MARGINAL') {
            strategicInsights.push('→ MARGINAL: Proceed carefully, avoid overcommitting');
        } else if (tier === 'WEAK' || tier === 'AIR') {
            strategicInsights.push('→ WEAK: Consider fold or bluff with fold equity');
        }
    }

    // 2. SPR Implications
    if (input.spr) {
        const zone = input.spr.spr_zone;
        const shovezone = input.spr.commitment_thresholds?.shove_zone;

        strategicInsights.push(`SPR ZONE: ${zone}`);

        if (shovezone) {
            strategicInsights.push('→ ⚠️ SHOVE ZONE (SPR < 3): Plan to commit with decent hands');
        } else if (zone === 'POT_COMMITTED' || zone === 'COMMITTED') {
            strategicInsights.push('→ LOW SPR: Bet big or shove, hard to fold decent hands');
        } else if (zone === 'DEEP' || zone === 'VERY_DEEP') {
            strategicInsights.push('→ DEEP STACKS: More maneuvering room, pot control important');
        }
    }

    // 3. Range Dynamics
    const flopAdv = input.advantages?.flop;
    if (flopAdv) {
        const rangeLeader = flopAdv.range_advantage?.leader;
        const nutLeader = flopAdv.nut_advantage?.leader;

        if (rangeLeader === 'hero') {
            strategicInsights.push('RANGE ADVANTAGE: You - bet more frequently');
        } else if (rangeLeader === 'villain') {
            strategicInsights.push('RANGE DISADVANTAGE: Villain - play defensively');
        }

        if (nutLeader === 'hero') {
            strategicInsights.push('NUT ADVANTAGE: You - can apply max pressure');
        } else if (nutLeader === 'villain') {
            strategicInsights.push('NUT DISADVANTAGE: Villain - avoid big pots with marginal');
        }
    }

    // 4. Equity vs Odds
    const equityEdge = input.equity.equity_vs_range - input.equity.pot_odds.equity_needed;
    if (equityEdge > 0.10) {
        strategicInsights.push(`EQUITY EDGE: +${(equityEdge * 100).toFixed(0)}% - calling/raising profitable`);
    } else if (equityEdge < -0.10) {
        strategicInsights.push(`EQUITY DEFICIT: ${(equityEdge * 100).toFixed(0)}% - fold unless implied odds`);
    }

    // Output strategic insights
    if (strategicInsights.length > 0) {
        lines.push('KEY INSIGHTS:');
        strategicInsights.forEach(insight => {
            lines.push(`  • ${insight}`);
        });
        lines.push('');
    }

    lines.push('COACHING REQUIREMENT:');
    lines.push('When providing strategy, explain:');
    lines.push('1. WHAT to do (recommendation with %)');
    lines.push('2. WHY it\'s optimal (reference insights above)');
    lines.push('3. IF villain responds (raise/call), what next?');
    lines.push('4. MULTI-STREET plan (how to play turn/river)');
    lines.push('');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
}

/**
 * Try to generate preflop strategy using GTO ranges (no LLM)
 * Returns null if the scenario isn't covered by ranges
 */
function tryGeneratePreflopFromRanges(input: Agent5Input): GTOStrategy | null {
    const heroHand = input.heroHand || '';
    const heroPosition = input.positions?.hero || '';


    // Detect if this is an RFI -> vs 3-bet scenario
    const preflopActions = input.actions.filter(a => a.street === 'preflop');
    const heroFirstAction = preflopActions.find(a => a.player === 'hero');
    const heroOpened = heroFirstAction && (heroFirstAction.action === 'raise' || heroFirstAction.action === 'bet');

    // Check if we faced a 3-bet (villain raised after us)
    // Heuristic: villainContext is 'facing_action' AND we opened
    const isVs3Bet = input.villainContext?.type === 'facing_action' && heroOpened;

    if (isVs3Bet) {
        // 1. Get Opening Action (Initial)
        // We act as if villainContext is 'opening' to get the RFI logic
        const openResult = getPreflopAction(heroHand, heroPosition, { type: 'opening', villain: null });

        // 2. Get Vs 3-Bet Action (Response)
        // Call getVs3BetAction directly to lookup in VS_THREE_BET_RANGES
        // CRITICAL: Use villain POSITION, not player name!
        const threeBettorPosition = input.villainContext?.villain || input.positions?.villain || '';


        console.error(`[Agent5] Context villain field: ${input.villainContext?.villain}`);

        const vs3BetResult = getVs3BetAction(heroHand, heroPosition, threeBettorPosition);

        console.error(`[Agent5] Loopkup Result: found=${vs3BetResult.found}, action=${vs3BetResult.action?.action}`);

        if (!openResult.found && !vs3BetResult.found) return null;

        // Build the composite strategy - ensure initial_action is present with fallback
        const strategy: GTOStrategy = {
            preflop: {
                initial_action: {
                    primary: { action: 'fold', frequency: 1.0, reasoning: 'Fallback initialization' }
                }
            }
        };

        // Initial Action (Open)
        if (openResult.found) {
            const normalizedHand = normalizeHand(heroHand);
            // Map 3bet/4bet to 'raise' for ActionType compatibility
            const openActionName = (openResult.action.action === 'raise' || openResult.action.action === '3bet' || openResult.action.action === '4bet') ? 'raise' : openResult.action.action;

            strategy.preflop.initial_action = {
                primary: {
                    action: openActionName as any,
                    sizing: openResult.action.sizing,
                    frequency: openResult.action.frequency,
                    reasoning: generatePreflopReasoning(heroHand, openActionName as any, heroPosition, 'table', openResult.action.frequency)
                }
            };
        }

        // Response to 3-bet
        console.error('[Agent5 3BET DEBUG] vs3BetResult:', JSON.stringify(vs3BetResult, null, 2));
        console.error('[Agent5 3BET DEBUG] vs3BetResult.found:', vs3BetResult.found);
        console.error('[Agent5 3BET DEBUG] vs3BetResult.action:', vs3BetResult.action);

        if (vs3BetResult.found) {
            const normalizedHand = normalizeHand(heroHand);
            const vs3BetActionName = (vs3BetResult.action.action === 'raise' || vs3BetResult.action.action === '3bet' || vs3BetResult.action.action === '4bet') ? 'raise' : vs3BetResult.action.action;

            console.error('[Agent5 3BET DEBUG] Setting response_to_3bet with action:', vs3BetActionName);

            // Generate reasoning based on actual action
            // Generate reasoning based on actual action using PreflopReasoningEngine
            const vs3betReasoning = generatePreflopReasoning(
                heroHand,
                vs3BetActionName as any,
                heroPosition,
                threeBettorPosition || 'Villain',
                vs3BetResult.action.frequency
            );

            strategy.preflop.response_to_3bet = {
                primary: {
                    action: vs3BetActionName as any,
                    sizing: vs3BetResult.action.sizing,
                    frequency: vs3BetResult.action.frequency,
                    reasoning: vs3betReasoning
                }
            };

            console.error('[Agent5 3BET DEBUG] response_to_3bet set to:', JSON.stringify(strategy.preflop.response_to_3bet, null, 2));
        } else {
            console.error('[Agent5 3BET DEBUG] vs3BetResult.found is FALSE - NOT setting response_to_3bet');
        }

        console.error('[Agent5 DEBUG] Final strategy.preflop:', JSON.stringify(strategy.preflop, null, 2));
        console.error('[Agent5 DEBUG] Returning composite strategy:', JSON.stringify(strategy, null, 2));
        return strategy;
    }

    // Standard Single-Action Logic (Opening or Limping or Cold Call)
    const villainContextForRanges = input.villainContext
        ? {
            type: input.villainContext.type,
            villain: input.villainContext.villainName || null
        }
        : undefined;

    const rangeResult = getPreflopAction(heroHand, heroPosition, villainContextForRanges);

    // If not found in ranges, return null to let LLM handle it
    if (!rangeResult.found) {
        return null;
    }

    const preflopAction = rangeResult.action;

    // Build the GTO strategy from range lookup
    const normalizedHand = normalizeHand(heroHand);
    const actionName = preflopAction.action === 'raise' || preflopAction.action === '3bet' || preflopAction.action === '4bet'
        ? 'raise'
        : preflopAction.action;

    const reasoning = generatePreflopReasoning(heroHand, actionName as any, heroPosition, 'table', preflopAction.frequency);

    return {
        preflop: {
            initial_action: {
                primary: {
                    action: actionName as any,
                    sizing: preflopAction.sizing,
                    frequency: preflopAction.frequency,
                    reasoning: reasoning
                }
            }
        }
    };
}

/**
 * Agent 5: Generate GTO Strategy with Mixed Strategy Support
 * 
 * ARCHITECTURE: Data-First, LLM-Second
 * - PREFLOP: Check gtoRanges FIRST, use LLM only if ranges don't cover
 * - POSTFLOP: Use LLM with board/equity context
 */
export async function agent5_gtoStrategy(input: Agent5Input): Promise<GTOStrategy> {
    const startTime = Date.now();

    // ==========================================================================
    // STEP 1: PREFLOP-ONLY HANDS - Use ranges first, skip LLM if possible
    // ==========================================================================
    const isPreflopOnly = input.streetsPlayed && !input.streetsPlayed.flop;

    if (isPreflopOnly) {
        // Try to handle with ranges - no LLM needed
        const rangeBasedStrategy = tryGeneratePreflopFromRanges(input);

        if (rangeBasedStrategy) {
            const duration = Date.now() - startTime;
            console.log(`[Agent 5: GTO Strategy] Preflop handled by RANGES in ${duration}ms`);
            return rangeBasedStrategy;
        }

        // Ranges didn't cover this scenario - fall through to LLM
        console.log('[Agent 5: GTO Strategy] Preflop scenario not in ranges, using LLM');
    }

    // ==========================================================================
    // STEP 2: Use LLM for postflop or uncovered preflop scenarios
    // ==========================================================================
    const contextText = formatContextForPrompt(input);

    // CRITICAL: Determine which streets to analyze based on streetsPlayed
    let streetsInstruction = '';
    if (input.streetsPlayed) {
        if (!input.streetsPlayed.flop) {
            streetsInstruction = '\n\nCRITICAL: Hero folded preflop. ONLY analyze the PREFLOP decision. DO NOT discuss flop, turn, or river in your output.';
        } else if (!input.streetsPlayed.turn) {
            streetsInstruction = '\n\nCRITICAL: Hero only saw preflop and flop. DO NOT discuss turn or river in your output.';
        } else if (!input.streetsPlayed.river) {
            streetsInstruction = '\n\nCRITICAL: Hero only saw preflop, flop, and turn. DO NOT discuss river in your output.';
        }
    }

    const userPrompt = `Generate a GTO decision tree with PRIMARY and ALTERNATIVE actions for this hand:

${contextText}${streetsInstruction}

IMPORTANT:
- For each decision point, provide PRIMARY (highest frequency action)
- Include ALTERNATIVE only when there's a genuine mixed strategy (10%+ for secondary)
- Use the equity (${(input.equity.equity_vs_range * 100).toFixed(1)}%) and pot odds (${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%) to inform decisions

ANTI-HALLUCINATION WARNING:
The SITUATION section above explicitly states whether Hero is IN POSITION or OUT OF POSITION.
You MUST use this exact position context in your reasoning. DO NOT contradict it.
- If it says "Hero is IN POSITION", NEVER mention "out of position" or "positional disadvantage"
- If it says "Hero is OUT OF POSITION", NEVER mention "in position" or "positional advantage"`;

    // Build position-specific system prompt
    const actingOrder = determineActingOrder(input.positions.hero);

    let positionInstructions = '';
    let jsonFormatExample = '';

    // Check if hand ended preflop (isPreflopOnly already declared above)

    if (isPreflopOnly) {
        // PREFLOP ONLY HAND
        positionInstructions = `
CRITICAL: Hand ended PREFLOP. 
ONLY generate strategy for the PREFLOP decision tree.
DO NOT generate any strategy for Flop, Turn, or River.

PREFLOP DECISION TREE:
1. **initial_action**: Hero's first action (Open, Call, or Fold)
2. **response_to_3bet**: IF Hero opens and Villain 3-bets -> What is the response?
3. **response_to_4bet**: IF Hero 3-bets and Villain 4-bets -> What is the response?`;

        jsonFormatExample = `
Return JSON in this EXACT format:
{
  "preflop": {
    "initial_action": { "primary": {"action": "raise", "frequency": 1.0, "reasoning": "..."} },
    "response_to_3bet": { "primary": {"action": "call", "frequency": 0.8, "reasoning": "..."} },
    "response_to_4bet": null
  }
}`;
    } else if (actingOrder === 'hero_first') {
        // Hero is OUT OF POSITION (SB/BB) - acts first postflop
        positionInstructions = `
POSITION CONTEXT: Hero is OUT OF POSITION (${input.positions.hero}). 
CRITICAL: Hero acts FIRST on all postflop streets.

For each postflop street, provide recommendations for these decision points:
1. **initial_action**: What hero does when acting first (bet/check)
2. **if_check_and_villain_bets**: What hero does after checking and villain bets (call/fold/raise)
3. **if_bet_and_villain_raises**: What hero does if hero bets and villain raises (call/fold)

PREFLOP TREE:
Also include full preflop tree (initial + response to 3bet/4bet)`;

        jsonFormatExample = `
Return JSON in this EXACT format:
{
  "preflop": {
    "initial_action": { "primary": {"action": "raise", "frequency": 1.0, "reasoning": "..."} },
    "response_to_3bet": { "primary": {"action": "call", "frequency": 1.0, "reasoning": "..."} }
  },
  "flop": {
    "initial_action": {
      "primary": {"action": "bet/check", "sizing": "% pot", "frequency": 0.6, "reasoning": "..."},
      "alternative": {"action": "check/bet", "frequency": 0.4, "reasoning": "..."}
    },
    "if_check_and_villain_bets": {
      "primary": {"action": "call/fold/raise", "frequency": 0.7, "reasoning": "..."}
    },
    "if_bet_and_villain_raises": {
      "primary": {"action": "call/fold", "frequency": 0.8, "reasoning": "..."}
    }
  },
  "turn": { ... same structure ... },
  "river": { ... same structure ... }
}`;
    } else {
        // Hero is IN POSITION (BTN/CO/HJ) - acts second postflop
        positionInstructions = `
POSITION CONTEXT: Hero is IN POSITION (${input.positions.hero}). 
CRITICAL: Villain acts FIRST on all postflop streets. Hero acts SECOND and responds.

For each postflop street, provide recommendations for these decision points:
1. **if_villain_checks**: What hero does when villain checks to hero (bet/check)
2. **if_villain_bets**: What hero does when villain bets (call/fold/raise)
3. **if_hero_bets_and_villain_raises**: What hero does if hero bets (after villain checked) and villain raises (call/fold)`;

        jsonFormatExample = `
Return JSON in this EXACT format:
{
  "preflop": {
    "initial_action": { "primary": {"action": "raise", "frequency": 1.0, "reasoning": "..."} },
    "response_to_3bet": { "primary": {"action": "call", "frequency": 1.0, "reasoning": "..."} }
  },
  "flop": {
    "if_villain_checks": {
      "primary": {"action": "bet/check", "sizing": "% pot", "frequency": 0.7, "reasoning": "..."},
      "alternative": {"action": "check/bet", "frequency": 0.3, "reasoning": "..."}
    },
    "if_villain_bets": {
      "primary": {"action": "call/fold/raise", "frequency": 0.6, "reasoning": "..."}
    },
    "if_hero_bets_and_villain_raises": {
      "primary": {"action": "call/fold", "frequency": 0.8, "reasoning": "..."}
    }
  },
  "turn": { ... same structure ... },
  "river": { ... same structure ... }
}`;
    }

    // Inject position-specific instructions and JSON format into prompt
    const systemPrompt = GTO_STRATEGY_PROMPT
        .replace('[POSITION_SPECIFIC_INSTRUCTIONS]', positionInstructions)
        .replace('[JSON_FORMAT_EXAMPLE]', jsonFormatExample);


    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 3000,  // Increased for mixed strategy output
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const strategy = JSON.parse(content) as GTOStrategy;

        const duration = Date.now() - startTime;
        console.log(`[Agent 5: GTO Strategy] Completed in ${duration}ms`);

        return strategy;

    } catch (error) {
        console.error('[Agent 5: GTO Strategy] Error:', error);
        return createFallbackStrategy(input);
    }
}

/**
 * Create fallback strategy with mixed format
 */
function createFallbackStrategy(input: Agent5Input): GTOStrategy {
    const isProfitable = input.equity.equity_vs_range > input.equity.pot_odds.equity_needed;
    const hasRangeAdvantage = input.advantages.flop?.range_advantage.leader === 'hero';

    const defaultMixedAction: MixedActionRecommendation = {
        primary: {
            action: hasRangeAdvantage ? 'bet' : 'check',
            frequency: 0.7,
            sizing: '65%',
            reasoning: 'Unable to generate detailed strategy'
        },
        alternative: {
            action: hasRangeAdvantage ? 'check' : 'bet',
            frequency: 0.3,
            reasoning: 'Alternative line'
        }
    };

    // Detect preflop aggression level for fallback
    let preflopResponse: MixedActionRecommendation | undefined;
    const preflopActions = input.actions.filter(a => a.street === 'preflop');
    const heroDidAct = preflopActions.some(a => a.player === 'hero');
    const villain3Bet = preflopActions.some(a => a.player === 'villain' && a.action === 'raise' && a.amount! > 1.0); // Rough heuristic

    if (villain3Bet && heroDidAct) {
        preflopResponse = {
            primary: {
                action: isProfitable ? 'call' : 'fold',
                frequency: 1.0,
                reasoning: 'Response to 3-bet (Fallback)'
            }
        };
    }

    // Use GTO range tables for preflop instead of hardcoded 'raise'
    const heroHand = input.heroHand || '';
    const heroPosition = input.positions?.hero || 'BTN';

    // Transform villainContext to match expected type
    const villainContextForRanges = input.villainContext
        ? {
            type: input.villainContext.type,
            villain: input.villainContext.villainName || null
        }
        : undefined;

    const rangeResult = getPreflopAction(
        heroHand,
        heroPosition,
        villainContextForRanges
    );

    // Build preflop decision based on range lookup
    const preflopAction = rangeResult.action;
    const preflopPrimary = {
        action: preflopAction.action === 'raise' || preflopAction.action === '3bet' || preflopAction.action === '4bet'
            ? 'raise'
            : preflopAction.action,
        sizing: preflopAction.sizing,
        frequency: preflopAction.frequency,
        reasoning: rangeResult.found
            ? `GTO ${heroPosition} range: ${normalizeHand(heroHand)} ${preflopAction.action === 'fold' ? 'not in range' : 'in range'} (${(preflopAction.frequency * 100).toFixed(0)}%)`
            : 'Range not found, using equity-based fallback'
    };

    return {
        preflop: {
            initial_action: {
                primary: preflopPrimary as any
            },
            response_to_3bet: preflopResponse
        },
        flop: {
            initial_action: { ...defaultMixedAction },
            if_check_and_villain_bets: {
                primary: {
                    action: isProfitable ? 'call' : 'fold',
                    frequency: 0.8,
                    reasoning: `Equity ${(input.equity.equity_vs_range * 100).toFixed(0)}% vs ${(input.equity.pot_odds.equity_needed * 100).toFixed(0)}% needed`
                }
            }
        },
        turn: {
            initial_action: { ...defaultMixedAction },
            if_check_and_villain_bets: {
                primary: {
                    action: isProfitable ? 'call' : 'fold',
                    frequency: 0.8,
                    reasoning: 'Based on equity analysis'
                }
            }
        },
        river: {
            initial_action: { ...defaultMixedAction },
            if_check_and_villain_bets: {
                primary: {
                    action: isProfitable ? 'call' : 'fold',
                    frequency: 0.8,
                    reasoning: 'Based on equity analysis'
                }
            }
        }
    };
}

export { formatContextForPrompt, GTO_STRATEGY_PROMPT };
