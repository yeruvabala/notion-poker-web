/**
 * Agent 1: Range Builder
 * 
 * PURPOSE: Build position-based ranges that narrow street-by-street
 * 
 * This agent constructs the starting ranges for both hero and villain
 * based on their positions, then narrows those ranges based on actions
 * taken on each street.
 * 
 * RUNS: Tier 2 (parallel with Agent 4)
 * NEEDS: Agent 0 output (board analysis)
 * MODEL: GPT-4o
 * TOOLS: None (LLM knows ranges from training)
 * TIME: ~800ms
 */

import OpenAI from 'openai';
import { Agent1Input, RangeData, BoardAnalysis, Action, Position } from '../types/agentContracts';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for range building - comprehensive range knowledge
const RANGE_BUILDER_SYSTEM_PROMPT = `You are a poker range construction expert. Your job is to build accurate ranges based on positions and actions.

POSITION-BASED OPENING RANGES (6-max):
- UTG: 10-12% (22+, ATs+, KQs, AJo+, KQo)
- HJ: 14-16% (22+, A8s+, KTs+, QJs, ATo+, KJo+)
- CO: 20-25% (22+, A2s+, K6s+, Q8s+, J9s+, T9s, 98s, ATo+, KTo+, QJo)
- BTN: 35-45% (22+, A2s+, K2s+, Q4s+, J7s+, T7s+, 97s+, 87s, 76s, 65s, A2o+, K7o+, Q9o+, JTo)
- SB: 30-40% (similar to BTN but slightly tighter)
- BB: Defends 40-50% of hands when facing raise

CALLING RANGES vs OPEN:
- Need to defend at minimum defense frequency (MDF)
- Position matters: Call wider IP, tighter OOP
- Cold calling range: Remove hands that should 3-bet

3-BET RANGES:
- Value: AA-TT, AK-AQ, sometimes AJs, KQs
- Bluffs: A5s-A2s, suited connectors like 76s, 87s

HOW RANGES NARROW PER STREET:
1. After betting: Betting range is polarized (strong hands + bluffs)
2. After calling: Calling range is capped (no monsters, but decent holdings)
3. After raising: Only very strong hands or bluffs
4. After checking: Mostly weak/medium strength hands

Return JSON in this exact format:
{
  "preflop": {
    "hero_range": {
      "description": "hand range notation like 22+, ATs+",
      "combos": number of combo count,
      "spectrum": "top X% of hands"
    },
    "villain_range": {
      "description": "hand range notation",
      "combos": number,
      "spectrum": "description"
    }
  },
  "flop": {
    "hero_range": "narrowed range after flop action",
    "villain_range": "narrowed range after flop action",
    "range_notes": "explanation of how ranges changed"
  },
  "turn": {
    "hero_range": "further narrowed",
    "villain_range": "further narrowed",
    "range_notes": "explanation"
  },
  "river": {
    "hero_range": "final range",
    "villain_range": "final range",
    "range_notes": "explanation"
  }
}

RULES:
1. Use standard hand notation (AA, AKs, AKo, 22+, A2s+, etc.)
2. Consider board texture when narrowing (e.g., K-high board = keep Kx hands)
3. Be specific about combo counts when possible
4. Note when ranges become "capped" (no nuts possible)
5. Only include streets that have actions`;

/**
 * Format actions for the prompt
 */
function formatActionsForPrompt(actions: Action[]): string {
    const streetActions: Record<string, string[]> = {
        preflop: [],
        flop: [],
        turn: [],
        river: []
    };

    for (const action of actions) {
        const actionStr = action.amount
            ? `${action.player} ${action.action} $${action.amount}`
            : `${action.player} ${action.action}`;
        streetActions[action.street].push(actionStr);
    }

    let result = '';
    for (const [street, acts] of Object.entries(streetActions)) {
        if (acts.length > 0) {
            result += `${street.toUpperCase()}: ${acts.join(' → ')}\n`;
        }
    }

    return result.trim();
}

/**
 * Agent 1: Build Ranges
 * 
 * @param input - Board analysis, positions, and actions
 * @returns RangeData - Ranges for both players at each street
 */
export async function agent1_rangeBuilder(input: Agent1Input): Promise<RangeData> {
    const startTime = Date.now();

    const actionsFormatted = formatActionsForPrompt(input.actions);

    // Build the prompt
    const userPrompt = `Build ranges for this poker hand:

POSITIONS:
- Hero: ${input.positions.hero}
- Villain: ${input.positions.villain}

BOARD:
${input.boardAnalysis.flop ? `Flop: ${input.boardAnalysis.flop.cards} (${input.boardAnalysis.flop.texture})` : ''}
${input.boardAnalysis.turn ? `Turn: ${input.boardAnalysis.turn.card} (${input.boardAnalysis.turn.impact})` : ''}
${input.boardAnalysis.river ? `River: ${input.boardAnalysis.river.card}` : ''}

ACTIONS:
${actionsFormatted}

Build accurate ranges for both players at each street based on positions and actions.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: RANGE_BUILDER_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2, // Slightly higher for range creativity
            max_tokens: 1200,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const ranges = JSON.parse(content) as RangeData;

        // Log timing for debugging
        const duration = Date.now() - startTime;
        console.log(`[Agent 1: Range Builder] Completed in ${duration}ms`);

        return ranges;

    } catch (error) {
        console.error('[Agent 1: Range Builder] Error:', error);

        // Return fallback ranges based on position
        return createFallbackRanges(input.positions);
    }
}

/**
 * Create fallback ranges if LLM call fails
 */
function createFallbackRanges(positions: Position): RangeData {
    // Default ranges based on position
    const positionRanges: Record<string, { desc: string; combos: number; spectrum: string }> = {
        'UTG': { desc: '22+, ATs+, KQs, AJo+, KQo', combos: 156, spectrum: 'Top 10%' },
        'HJ': { desc: '22+, A8s+, KTs+, QJs, ATo+, KJo+', combos: 210, spectrum: 'Top 14%' },
        'CO': { desc: '22+, A2s+, K6s+, Q8s+, J9s+, ATo+, KTo+', combos: 300, spectrum: 'Top 22%' },
        'BTN': { desc: '22+, A2s+, K2s+, wide suited, ATo+', combos: 450, spectrum: 'Top 35%' },
        'SB': { desc: '22+, A2s+, K5s+, suited connectors', combos: 400, spectrum: 'Top 30%' },
        'BB': { desc: 'Defending vs raise: wide', combos: 500, spectrum: 'Top 40%' },
    };

    const heroRange = positionRanges[positions.hero] || positionRanges['CO'];
    const villainRange = positionRanges[positions.villain] || positionRanges['BTN'];

    return {
        preflop: {
            hero_range: {
                description: heroRange.desc,
                combos: heroRange.combos,
                spectrum: heroRange.spectrum
            },
            villain_range: {
                description: villainRange.desc,
                combos: villainRange.combos,
                spectrum: villainRange.spectrum
            }
        }
    };
}

// Export for testing
export { formatActionsForPrompt, RANGE_BUILDER_SYSTEM_PROMPT };
