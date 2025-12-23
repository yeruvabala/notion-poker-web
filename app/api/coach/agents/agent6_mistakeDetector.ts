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
    Position
} from '../types/agentContracts';

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

For each street, compare hero's FIRST action to initial_action and SECOND action (if any) to the appropriate response recommendation.

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
      "street": "flop/turn/river",
      "decision_point": "initial_action" or "facing_bet",
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
    equity: number,
    potOddsNeeded: number,
    positions: Position // ADDED
): string {
    const lines: string[] = [];

    lines.push('HERO\'S ACTION SEQUENCE:');
    lines.push('');

    // Preflop
    if (heroActions.preflop?.first) {
        lines.push(`PREFLOP:`);
        lines.push(`  Hero first: ${heroActions.preflop.first.action}`);
        lines.push(`  GTO: ${gtoStrategy.preflop?.action || 'N/A'}`);
        lines.push('');
    }

    // Helper to format GTO recommendation
    const formatGtoRec = (rec: MixedActionRecommendation | undefined, label: string) => {
        if (!rec) return;
        lines.push(`  ${label} primary: ${rec.primary?.action} (${((rec.primary?.frequency || 1) * 100).toFixed(0)}%)`);
        if (rec.alternative) {
            lines.push(`  ${label} alternative: ${rec.alternative.action} (${((rec.alternative.frequency || 0) * 100).toFixed(0)}%)`);
        }
    };

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
                formatGtoRec(gtoStrategy.turn.if_villain_checks, "GTO (vs Check)");
            } else {
                formatGtoRec(gtoStrategy.turn.if_villain_bets, "GTO (vs Bet)");
            }

            if (heroActions.turn.second) {
                lines.push(`  Hero second action: ${heroActions.turn.second.action}`);
                formatGtoRec(gtoStrategy.turn.if_hero_bets_and_villain_raises, "GTO (vs Raise)");
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
                formatGtoRec(gtoStrategy.river.if_villain_checks, "GTO (vs Check)");
            } else {
                formatGtoRec(gtoStrategy.river.if_villain_bets, "GTO (vs Bet)");
            }

            if (heroActions.river.second) {
                lines.push(`  Hero second action: ${heroActions.river.second.action}`);
                formatGtoRec(gtoStrategy.river.if_hero_bets_and_villain_raises, "GTO (vs Raise)");
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

    lines.push(`EQUITY: ${(equity * 100).toFixed(1)}%`);
    lines.push(`POT ODDS NEEDED: ${(potOddsNeeded * 100).toFixed(1)}%`);
    lines.push(`CALLING IS: ${equity > potOddsNeeded ? 'PROFITABLE' : 'UNPROFITABLE'}`);
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

    const comparisonPrompt = buildComparisonPrompt(
        input.gtoStrategy,
        input.heroActions,
        input.equity.equity_vs_range,
        input.equity.pot_odds.equity_needed,
        input.positions // ADDED
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
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: MISTAKE_DETECTOR_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 2500,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const rawAnalysis = JSON.parse(content);

        // Transform to MistakeAnalysis format
        const analysis: MistakeAnalysis = {
            mistakes: rawAnalysis.mistakes || [],
            total_ev_lost: 0,
            severity_summary: {
                critical: 0,
                moderate: 0,
                minor: 0
            },
            primary_leak: rawAnalysis.primary_leak,
            // Add new fields for 3-tier classification
            decisions: rawAnalysis.decisions,
            summary: rawAnalysis.summary
        };

        const duration = Date.now() - startTime;
        console.log(`[Agent 6: Mistake Detector] Completed in ${duration}ms`);

        return analysis;

    } catch (error) {
        console.error('[Agent 6: Mistake Detector] Error:', error);
        return createFallbackAnalysis();
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
