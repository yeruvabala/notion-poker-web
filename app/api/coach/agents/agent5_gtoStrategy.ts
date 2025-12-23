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
    ActionRecommendation
} from '../types/agentContracts';

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

    // ADD: Situation overview with positions
    lines.push('SITUATION:');
    lines.push(`Hero: ${input.positions?.hero || 'Unknown'} with ${input.heroHand}`);
    lines.push(`Villain: ${input.positions?.villain || 'Unknown'}`);
    lines.push('');

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

    lines.push(`HERO'S HAND: ${input.heroHand}`);
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

    // Ranges
    lines.push('RANGES:');
    lines.push(`Preflop - Hero: ${input.ranges.preflop.hero_range.description} (${input.ranges.preflop.hero_range.spectrum})`);
    lines.push(`Preflop - Villain: ${input.ranges.preflop.villain_range.description}`);
    if (input.ranges.flop) {
        lines.push(`Flop - Hero: ${input.ranges.flop.hero_range}`);
        lines.push(`Flop - Villain: ${input.ranges.flop.villain_range}`);
    }
    if (input.ranges.river) {
        lines.push(`River - Villain: ${input.ranges.river.villain_range}`);
    }
    lines.push('');

    // Equity
    lines.push('EQUITY:');
    lines.push(`Hero equity vs villain range: ${(input.equity.equity_vs_range * 100).toFixed(1)}%`);
    lines.push(`Pot odds needed: ${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%`);
    if (input.equity.breakdown) {
        lines.push(`Beats: ${input.equity.breakdown.beats?.join(', ') || 'N/A'}`);
        lines.push(`Loses to: ${input.equity.breakdown.loses_to?.join(', ') || 'N/A'}`);
    }
    lines.push('');

    // Advantages
    lines.push('ADVANTAGES:');
    if (input.advantages.flop) {
        lines.push(`Flop range advantage: ${input.advantages.flop.range_advantage.leader} (${input.advantages.flop.range_advantage.percentage})`);
        lines.push(`Flop nut advantage: ${input.advantages.flop.nut_advantage.leader}`);
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

    return lines.join('\n');
}

/**
 * Agent 5: Generate GTO Strategy with Mixed Strategy Support
 */
export async function agent5_gtoStrategy(input: Agent5Input): Promise<GTOStrategy> {
    const startTime = Date.now();

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
- Use the equity (${(input.equity.equity_vs_range * 100).toFixed(1)}%) and pot odds (${(input.equity.pot_odds.equity_needed * 100).toFixed(1)}%) to inform decisions`;

    // Build position-specific system prompt
    const actingOrder = determineActingOrder(input.positions.hero);

    let positionInstructions = '';
    let jsonFormatExample = '';

    // Check if hand ended preflop
    const isPreflopOnly = input.streetsPlayed && !input.streetsPlayed.flop;

    if (isPreflopOnly) {
        // PREFLOP ONLY HAND
        positionInstructions = `
CRITICAL: Hand ended PREFLOP. 
ONLY generate strategy for the PREFLOP decision.
DO NOT generate any strategy for Flop, Turn, or River.`;

        jsonFormatExample = `
Return JSON in this EXACT format:
{
  "preflop": {
    "action": "raise/call/fold",
    "sizing": "amount",
    "reasoning": "explanation"
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
3. **if_bet_and_villain_raises**: What hero does if hero bets and villain raises (call/fold)`;

        jsonFormatExample = `
Return JSON in this EXACT format:
{
  "preflop": {
    "action": "raise/call/fold",
    "sizing": "amount",
    "reasoning": "explanation"
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
    "action": "raise/call/fold",
    "sizing": "amount",
    "reasoning": "explanation"
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

    return {
        preflop: {
            action: 'raise',
            sizing: '2.5bb',
            reasoning: 'Standard open from position'
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
