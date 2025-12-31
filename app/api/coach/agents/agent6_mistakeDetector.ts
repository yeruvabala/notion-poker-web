/**
 * Agent 6: Mistake Detector (3-TIER CLASSIFICATION VERSION)
 * 
 * PURPOSE: Compare hero's play to GTO with 3-tier classification:
 * 
 * 1. OPTIMAL (Green)     - Hero matched PRIMARY GTO action
 * 2. ACCEPTABLE (Yellow) - Hero matched ALTERNATIVE GTO action  
 * 3. MISTAKE (Red)       - Hero chose action not in GTO options
 * 
 * RUNS: Tier 5 (LAST - needs ALL previous outputs)
 * MODEL: GPT-4o
 */

import OpenAI from 'openai';
import {
    Agent6Input,
    MistakeAnalysis,
    GTOStrategy,
    MixedActionRecommendation,
    HeroActions,
    HeroStreetActions,
    Street,
    ActionType,
    PlayQuality,
    Position,
    EquityData,
    SPRData,
    HeroClassification
} from '../types/agentContracts';
import { MistakeClassifier, AnalysisContext } from '../utils/MistakeClassifier';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function getOpenAI(): OpenAI {
    return openai;
}

// System prompt for 3-tier classification
const MISTAKE_DETECTOR_PROMPT = `You are a poker play classifier. Compare hero's actions to GTO recommendations and classify each decision.

CRITICAL: GTO often has MIXED STRATEGIES with PRIMARY and ALTERNATIVE options:
- **OPTIMAL**: Hero matched the PRIMARY action (highest frequency)
- **ACCEPTABLE**: Hero matched the ALTERNATIVE action (also valid, lower frequency)
- **MISTAKE**: Hero chose an action NOT in the GTO options

For each street WHERE HERO HAD AN ACTION, compare hero's action(s) to GTO recommendations.
**IMPORTANT**: If hero had a preflop action, you MUST include preflop in the decisions array.

CLASSIFICATION RULES:
1. If hero_action === primary.action → PlayQuality: "optimal"
2. If hero_action === alternative.action → PlayQuality: "acceptable"
3. If hero_action is neither primary nor alternative → PlayQuality: "mistake"
4. If no alternative exists and hero != primary → PlayQuality: "mistake"

DO NOT mark as mistake if:
- Hero matched the primary action
- Hero matched the alternative action
- Calling with equity > pot odds (usually correct)

Return JSON:
{
  "decisions": [
    {
      "street": "preflop/flop/turn/river",
      "decision_point": "initial_action" or "facing_bet" or "response_to_3bet",
      "hero_action": "check/bet/call/fold/raise",
      "gto_primary": { "action": "...", "frequency": 0.6 },
      "gto_alternative": { "action": "...", "frequency": 0.4 } or null,
      "play_quality": "optimal/acceptable/mistake",
      "reasoning": "explanation of classification"
    }
  ],
  "summary": {
    "optimal_count": 3,
    "acceptable_count": 1,
    "mistake_count": 0,
    "overall_assessment": "Excellent play! Mostly optimal with one acceptable alternative."
  },
  "mistakes": [],
  "primary_leak": null
}

Only populate "mistakes" array if play_quality === "mistake".`;

/**
 * Build comparison prompt for the LLM
 */
function buildComparisonPrompt(
    gtoStrategy: GTOStrategy,
    heroActions: HeroActions,
    equity: EquityData,
    potOddsNeeded: number,
    positions: Position,
    spr: SPRData, // Phase 14: Add SPR context
    heroClassification?: HeroClassification, // Phase 14: Add hero classification
    ranges?: any // Phase 14: Add ranges for context
): string {
    const lines: string[] = [];

    lines.push('HERO\'S ACTION SEQUENCE:');
    lines.push('');

    // Helper to format GTO recommendation
    const formatGtoRec = (rec: MixedActionRecommendation | undefined, label: string) => {
        if (!rec) return;
        lines.push(`  ${label} primary: ${rec.primary?.action} (${((rec.primary?.frequency || 1) * 100).toFixed(0)}%)`);
        if (rec.alternative) {
            lines.push(`  ${label} alternative: ${rec.alternative.action} (${((rec.alternative.frequency || 0) * 100).toFixed(0)}%)`);
        }
    };

    // Preflop
    if (heroActions.preflop?.first) {
        lines.push(`PREFLOP:`);
        lines.push(`  Hero first: ${heroActions.preflop.first.action}`);
        formatGtoRec(gtoStrategy.preflop.initial_action, "GTO Initial");

        if (heroActions.preflop.second) {
            lines.push(`  Hero second: ${heroActions.preflop.second.action}`);
            // If hero acts twice preflop, it's likely a 3-bet response
            formatGtoRec(gtoStrategy.preflop.response_to_3bet, "GTO Response (3-bet)");
        }
        lines.push('');
    }



    const isIP = !['SB', 'BB'].includes(positions.hero.toUpperCase());

    // Flop
    if (heroActions.flop?.first && gtoStrategy.flop) {
        lines.push(`FLOP:`);
        lines.push(`  Hero first action: ${heroActions.flop.first.action}`);

        if (isIP) {
            // IN POSITION - Context depends on Villain's action
            // Hero acts second. Context determined by Hero's available actions.
            // If Hero Checks or Bets -> Villain Checked
            // If Hero Calls, Raises, or Folds -> Villain Bet
            const action = heroActions.flop.first.action;
            const villainChecked = ['check', 'bet'].includes(action);

            if (villainChecked) {
                formatGtoRec(gtoStrategy.flop.if_villain_checks_to_hero, "GTO (vs Check)");
            } else {
                formatGtoRec(gtoStrategy.flop.if_villain_bets_into_hero, "GTO (vs Bet)");
            }

            // Second action (Hero Bets -> Villain Raises -> Hero Respond)
            if (heroActions.flop.second) {
                lines.push(`  Hero second action: ${heroActions.flop.second.action}`);
                formatGtoRec(gtoStrategy.flop.if_bet_and_villain_raises, "GTO (vs Raise)");
            }

        } else {
            // OUT OF POSITION - Hero acts first
            const flopInitial = gtoStrategy.flop.initial_action;
            formatGtoRec(flopInitial, "GTO Initial");

            if (heroActions.flop.second) {
                lines.push(`  Hero second action: ${heroActions.flop.second.action}`);
                const flopFacing = heroActions.flop.first.action === 'check'
                    ? gtoStrategy.flop.if_check_and_villain_bets
                    : gtoStrategy.flop.if_bet_and_villain_raises;
                formatGtoRec(flopFacing, "GTO Response");
            }
        }
        lines.push('');
    }

    // Turn
    if (heroActions.turn?.first && gtoStrategy.turn) {
        lines.push(`TURN:`);
        lines.push(`  Hero first action: ${heroActions.turn.first.action}`);

        if (isIP) {
            const action = heroActions.turn.first.action;
            const villainChecked = ['check', 'bet'].includes(action);

            if (villainChecked) {
                formatGtoRec(gtoStrategy.turn.if_villain_checks_to_hero, "GTO (vs Check)");
            } else {
                formatGtoRec(gtoStrategy.turn.if_villain_bets_into_hero, "GTO (vs Bet)");
            }

            if (heroActions.turn.second) {
                lines.push(`  Hero second action: ${heroActions.turn.second.action}`);
                formatGtoRec(gtoStrategy.turn.if_bet_and_villain_raises, "GTO (vs Raise)");
            }
        } else {
            const turnInitial = gtoStrategy.turn.initial_action;
            formatGtoRec(turnInitial, "GTO Initial");

            if (heroActions.turn.second) {
                lines.push(`  Hero second action: ${heroActions.turn.second.action}`);
                const turnFacing = heroActions.turn.first.action === 'check'
                    ? gtoStrategy.turn.if_check_and_villain_bets
                    : gtoStrategy.turn.if_bet_and_villain_raises;
                formatGtoRec(turnFacing, "GTO Response");
            }
        }
        lines.push('');
    }

    // River
    if (heroActions.river?.first && gtoStrategy.river) {
        lines.push(`RIVER:`);
        lines.push(`  Hero first action: ${heroActions.river.first.action}`);

        if (isIP) {
            const action = heroActions.river.first.action;
            const villainChecked = ['check', 'bet'].includes(action);

            if (villainChecked) {
                formatGtoRec(gtoStrategy.river.if_villain_checks_to_hero, "GTO (vs Check)");
            } else {
                formatGtoRec(gtoStrategy.river.if_villain_bets_into_hero, "GTO (vs Bet)");
            }

            if (heroActions.river.second) {
                lines.push(`  Hero second action: ${heroActions.river.second.action}`);
                formatGtoRec(gtoStrategy.river.if_bet_and_villain_raises, "GTO (vs Raise)");
            }
        } else {
            const riverInitial = gtoStrategy.river.initial_action;
            formatGtoRec(riverInitial, "GTO Initial");

            if (heroActions.river.second) {
                lines.push(`  Hero second action: ${heroActions.river.second.action}`);
                const riverFacing = heroActions.river.first.action === 'check'
                    ? gtoStrategy.river.if_check_and_villain_bets
                    : gtoStrategy.river.if_bet_and_villain_raises;
                formatGtoRec(riverFacing, "GTO Response");
            }
        }
        lines.push('');
    }

    // Phase 14: SPR CONTEXT
    lines.push('SPR ANALYSIS:');
    const primarySPR = spr.river_spr || spr.turn_spr || spr.flop_spr || 10;
    lines.push(`  Zone: ${spr.spr_zone} (SPR: ${primarySPR.toFixed(1)})`);
    lines.push(`  Commitment Level: Must have ${spr.commitment_thresholds.min_hand_strength} to commit`);
    lines.push(`  Can fold TPTK: ${spr.commitment_thresholds.can_fold_tptk ? 'YES' : 'NO'}`);
    lines.push(`  Can fold Overpair: ${spr.commitment_thresholds.can_fold_overpair ? 'YES' : 'NO'}`);
    lines.push(`  Shove zone: ${spr.commitment_thresholds.shove_zone ? 'YES (SPR < 3 - must commit)' : 'NO'}`);
    lines.push('');

    // Phase 14: HERO HAND CONTEXT
    if (heroClassification) {
        lines.push('HERO HAND ANALYSIS:');
        lines.push(`  Classification: ${heroClassification.bucket2D} - ${heroClassification.description}`);
        lines.push(`  Tier: ${heroClassification.tier}`);
        lines.push(`  Range Position: ${heroClassification.percentile}`);
        lines.push(`  Strategic Assessment: ${heroClassification.interpretation}`);
        lines.push('');
    }

    // Phase 14: RANGE DYNAMICS
    if (ranges) {
        lines.push('RANGE DISTRIBUTIONS:');
        const heroStats = ranges.flop?.hero_range?.stats;
        const villainStats = ranges.flop?.villain_range?.stats;
        if (heroStats) {
            lines.push(`  Hero: ${(heroStats.monster * 100).toFixed(0)}% monsters, ${(heroStats.strong * 100).toFixed(0)}% strong`);
        }
        if (villainStats) {
            lines.push(`  Villain: ${(villainStats.monster * 100).toFixed(0)}% monsters, ${(villainStats.strong * 100).toFixed(0)}% strong`);
        }
        lines.push('');
    }

    lines.push(`EQUITY: ${(equity.equity_vs_range * 100).toFixed(1)}%`);
    lines.push(`POT ODDS NEEDED: ${(potOddsNeeded * 100).toFixed(1)}%`);

    // Phase 10: Split Equity
    if (equity.equity_vs_value !== undefined && equity.equity_vs_bluffs !== undefined) {
        lines.push(`- Equity vs VALUE: ${(equity.equity_vs_value * 100).toFixed(1)}%`);
        lines.push(`- Equity vs BLUFFS: ${(equity.equity_vs_bluffs * 100).toFixed(1)}%`);
    }

    lines.push(`CALLING IS: ${equity.equity_vs_range > potOddsNeeded ? 'PROFITABLE' : 'UNPROFITABLE'}`);
    lines.push('');
    lines.push('CLASSIFICATION GUIDE:');
    lines.push('- Hero matches PRIMARY → play_quality: "optimal"');
    lines.push('- Hero matches ALTERNATIVE → play_quality: "acceptable"');
    lines.push('- Hero matches NEITHER → play_quality: "mistake"');

    return lines.join('\n');
}

/**
 * Agent 6: Detect Mistakes with 3-Tier Classification
 */
export async function agent6_mistakeDetector(input: Agent6Input): Promise<MistakeAnalysis> {
    const startTime = Date.now();

    // Phase 14: Use deterministic classifier
    const potOddsNeeded = input.equity.pot_odds.equity_needed;

    // Build analysis context for classifier
    const context: AnalysisContext = {
        spr: input.spr,
        heroClassification: input.heroClassification,
        ranges: input.ranges,
        equity: input.equity,
        potOddsNeeded
    };

    // Deterministic classification (0ms, 100% accurate)
    const decisions = MistakeClassifier.analyzeAllDecisions(
        input.heroActions,
        input.gtoStrategy,
        input.positions,
        context
    );

    // Categorize leaks
    const leakCategories = MistakeClassifier.categorizeLeaks(decisions);
    const worstLeak = MistakeClassifier.identifyWorstLeak(leakCategories);

    // Build comparison prompt forLLM reasoning (optional)
    const comparisonPrompt = buildComparisonPrompt(
        input.gtoStrategy,
        input.heroActions,
        input.equity,
        potOddsNeeded,
        input.positions,
        input.spr,
        input.heroClassification,
        input.ranges
    );

    const userPrompt = `Classify hero's play against the GTO decision tree:

${comparisonPrompt}

GTO DECISION TREE:
${JSON.stringify(input.gtoStrategy, null, 2)}

For each decision point, classify as:
- "optimal" if hero matched primary action
- "acceptable" if hero matched alternative action
- "mistake" if hero matched neither

Provide a summary with counts and overall assessment.`;

    try {
        // Phase 14: Use deterministic decisions instead of LLM classification
        // Still call LLM for reasoning text (optional enhancement)
        const api = getOpenAI();
        const response = await api.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: MISTAKE_DETECTOR_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('No response from LLM');

        const llmResult = JSON.parse(content);

        // Phase 14: Use deterministic decisions, but enhance with LLM reasoning
        const enhancedDecisions = decisions.map((decision, idx) => {
            const llmDecision = llmResult.decisions?.[idx];
            return {
                street: decision.street,
                decision_point: decision.decision_point,
                hero_action: decision.hero_action,
                gto_primary: decision.gto_primary,
                gto_alternative: decision.gto_alternative,
                play_quality: decision.play_quality, // Deterministic classification
                reasoning: llmDecision?.reasoning || `Hero ${decision.play_quality === 'optimal' ? 'matched primary' : decision.play_quality === 'acceptable' ? 'matched alternative' : 'did not match GTO'}`,
                leak_category: decision.leak_category
            };
        });

        // Count play qualities
        const optimalCount = decisions.filter(d => d.play_quality === 'optimal').length;
        const acceptableCount = decisions.filter(d => d.play_quality === 'acceptable').length;
        const mistakeCount = decisions.filter(d => d.play_quality === 'mistake').length;

        // Extract mistakes
        const mistakes = decisions
            .filter(d => d.play_quality === 'mistake')
            .map(d => ({
                street: d.street,
                hero_action: d.hero_action,
                should_have: d.gto_primary.action,
                impact: `Should have ${d.gto_primary.action} (primary) instead of ${d.hero_action}`
            }));

        const duration = Date.now() - startTime;
        console.log(`[Agent 6: Mistake Detector] Completed in ${duration}ms`);
        console.log(`[Agent 6: Results] ${optimalCount} optimal, ${acceptableCount} acceptable, ${mistakeCount} mistakes`);
        if (worstLeak) {
            console.log(`[Agent 6: Primary Leak] ${worstLeak}`);
        }

        return {
            decisions: enhancedDecisions,
            summary: {
                optimal_count: optimalCount,
                acceptable_count: acceptableCount,
                mistake_count: mistakeCount,
                overall_assessment: llmResult.summary?.overall_assessment || `${optimalCount} optimal, ${acceptableCount} acceptable, ${mistakeCount} mistakes`
            },
            mistakes,
            primary_leak: llmResult.primary_leak || null,
            leak_categories: leakCategories, // Phase 14: Add leak categorization
            worst_leak: worstLeak // Phase 14: Add worst leak
        };

    } catch (error) {
        console.error('[Agent 6: Mistake Detector] Error:', error);

        // Fallback: return deterministic results without LLM reasoning
        const optimalCount = decisions.filter(d => d.play_quality === 'optimal').length;
        const acceptableCount = decisions.filter(d => d.play_quality === 'acceptable').length;
        const mistakeCount = decisions.filter(d => d.play_quality === 'mistake').length;

        return {
            decisions: decisions.map(d => ({
                ...d,
                reasoning: `Deterministic classification: ${d.play_quality}`
            })),
            summary: {
                optimal_count: optimalCount,
                acceptable_count: acceptableCount,
                mistake_count: mistakeCount,
                overall_assessment: 'Error occurred, showing deterministic results'
            },
            mistakes: decisions
                .filter(d => d.play_quality === 'mistake')
                .map(d => ({
                    street: d.street,
                    hero_action: d.hero_action,
                    should_have: d.gto_primary.action,
                    impact: 'Deterministic classification'
                })),
            primary_leak: null,
            leak_categories: leakCategories,
            worst_leak: worstLeak
        };
    }
}

/**
 * Create fallback analysis
 */
function createFallbackAnalysis(): MistakeAnalysis {
    return {
        mistakes: [],
        total_ev_lost: 0,
        severity_summary: {
            critical: 0,
            moderate: 0,
            minor: 0
        },
        primary_leak: undefined,
        decisions: [],
        summary: {
            optimal_count: 0,
            acceptable_count: 0,
            mistake_count: 0,
            overall_assessment: 'Unable to analyze'
        }
    };
}

export { buildComparisonPrompt, MISTAKE_DETECTOR_PROMPT };
