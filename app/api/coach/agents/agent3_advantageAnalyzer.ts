/**
 * Agent 3: Advantage Analyzer
 * 
 * PURPOSE: Determine range advantage, nut advantage, and blocker effects
 * 
 * This agent analyzes who has the strategic advantage on each street:
 * - Range advantage: Whose range hits the board better?
 * - Nut advantage: Who can have the strongest hands?
 * - Blocker effects: What strong hands does hero block?
 * 
 * RUNS: Tier 3 (parallel with Agent 2)
 * NEEDS: Agent 0 output (board), Agent 1 output (ranges)
 * MODEL: GPT-4o
 * TOOLS: None
 * TIME: ~700ms
 */

import OpenAI from 'openai';
import { Agent3Input, AdvantageData, BoardAnalysis, RangeData, BlockerEffects } from '../types/agentContracts';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for advantage analysis
const ADVANTAGE_ANALYZER_PROMPT = `You are a poker range and nut advantage expert. Your job is to determine who has the strategic advantage on each street.

RANGE ADVANTAGE:
- Who's range "hits" the board better?
- Tighter preflop ranges hit high card boards better (premium hands)
- Wider preflop ranges hit low/connected boards better (more combos)
- Example: K-high flop favors UTG raiser (more Kx in tight range)
- Example: 7-6-5 flop favors caller (more suited connectors in wide range)

NUT ADVANTAGE:
- Who can have the STRONGEST possible hands (nuts)?
- Preflop raiser usually has AA, KK, AK (villain often doesn't)
- If villain is "capped" (no premium hands in range), raiser has nut advantage
- Sets, straights, flushes - who can have these?

BLOCKER EFFECTS:
- What strong hands does hero block by holding certain cards?
- Example: Hero has A♠ → blocks nut flush
- Example: Hero has K → reduces combos of KK, AK, KQ
- Blockers affect bluffing frequency and calling decisions

HOW ADVANTAGES SHIFT:
- Flop can favor one player
- Turn can SHIFT advantage (e.g., turn A helps villain's Ax hands)
- River can complete draws, shifting nut advantage

Return JSON in this exact format:
{
  "flop": {
    "range_advantage": {
      "leader": "hero" or "villain" or "even",
      "percentage": "Hero 65%" or "Even 50-50",
      "reason": "why this player has range advantage"
    },
    "nut_advantage": {
      "leader": "hero" or "villain" or "even",
      "hero_strongest": "strongest hand hero can have",
      "villain_strongest": "strongest hand villain can have",
      "reason": "why this player has nut advantage"
    }
  },
  "turn": {
    "range_advantage": {...},
    "nut_advantage": {...},
    "shift": "how did turn change advantages?"
  },
  "river": {
    "range_advantage": {...},
    "nut_advantage": {...},
    "shift": "how did river change advantages?"
  },
  "blocker_effects": {
    "hero_blocks": ["list of hands/combos hero blocks"],
    "strategic_impact": "how blockers affect strategy"
  }
}

RULES:
1. Always consider preflop ranges when determining advantages
2. Note when ranges become "capped" (no nuts possible)
3. Be specific about which hands each player can have
4. Explain shifts clearly when advantages change
5. Only include streets that have cards`;

/**
 * Extract hero cards for blocker analysis
 */
function extractHeroCards(heroHand: string): { rank1: string; suit1: string; rank2: string; suit2: string } {
    // Handle formats like "K♥Q♥" or "KhQh" or "Kh Qh"
    const cleaned = heroHand.replace(/\s/g, '');

    // Map symbols to letters
    const suitMap: Record<string, string> = {
        '♠': 's', '♤': 's', '♥': 'h', '♡': 'h',
        '♦': 'd', '♢': 'd', '♣': 'c', '♧': 'c'
    };

    let rank1: string, suit1: string, rank2: string, suit2: string;

    if (cleaned.length >= 4) {
        rank1 = cleaned[0];
        suit1 = suitMap[cleaned[1]] || cleaned[1];
        rank2 = cleaned[2];
        suit2 = suitMap[cleaned[3]] || cleaned[3];
    } else {
        // Fallback
        rank1 = 'A';
        suit1 = 's';
        rank2 = 'K';
        suit2 = 's';
    }

    return { rank1, suit1, rank2, suit2 };
}

/**
 * Analyze potential blockers based on hero's hand
 */
function analyzeBlockersBasic(heroHand: string, board: BoardAnalysis): string[] {
    const { rank1, suit1, rank2, suit2 } = extractHeroCards(heroHand);
    const blockers: string[] = [];

    // Check for ace blockers (important for nut flushes)
    if (rank1 === 'A' || rank2 === 'A') {
        const aceSuit = rank1 === 'A' ? suit1 : suit2;
        blockers.push(`A${aceSuit === 's' ? '♠' : aceSuit === 'h' ? '♥' : aceSuit === 'd' ? '♦' : '♣'} blocks nut flush in that suit`);
        blockers.push('A blocks AA, AK combos');
    }

    // Check for king blockers
    if (rank1 === 'K' || rank2 === 'K') {
        blockers.push('K blocks KK, AK, KQ combos');
    }

    // Check for queen blockers
    if (rank1 === 'Q' || rank2 === 'Q') {
        blockers.push('Q blocks QQ, AQ, KQ combos');
    }

    // Check if hero blocks sets
    const boardCards = board.flop?.cards || '';
    if (boardCards.includes(rank1)) {
        blockers.push(`${rank1} blocks set of ${rank1}s`);
    }
    if (boardCards.includes(rank2)) {
        blockers.push(`${rank2} blocks set of ${rank2}s`);
    }

    // Check for flush blockers if flush possible
    if (board.summary?.flush_possible) {
        if (suit1 === suit2) {
            blockers.push(`Both cards are ${suit1} - blocks flush combos`);
        }
    }

    return blockers;
}

/**
 * Agent 3: Analyze Advantages
 * 
 * @param input - Board analysis, ranges, hero hand
 * @returns AdvantageData - Range/nut advantages per street + blockers
 */
export async function agent3_advantageAnalyzer(input: Agent3Input): Promise<AdvantageData> {
    const startTime = Date.now();

    // Pre-calculate basic blocker info to include in prompt
    const basicBlockers = analyzeBlockersBasic(input.heroHand, input.boardAnalysis);

    // Build the prompt
    const userPrompt = `Analyze advantages for this hand:

HERO HAND: ${input.heroHand}

BOARD:
${input.boardAnalysis.flop ? `Flop: ${input.boardAnalysis.flop.cards} (${input.boardAnalysis.flop.texture})` : ''}
${input.boardAnalysis.turn ? `Turn: ${input.boardAnalysis.turn.card} (${input.boardAnalysis.turn.impact})` : ''}
${input.boardAnalysis.river ? `River: ${input.boardAnalysis.river.card}` : ''}

PREFLOP RANGES:
- Hero (${input.ranges.preflop.hero_range.spectrum}): ${input.ranges.preflop.hero_range.description}
- Villain (${input.ranges.preflop.villain_range.spectrum}): ${input.ranges.preflop.villain_range.description}

POTENTIAL BLOCKERS (based on hero's cards):
${basicBlockers.length > 0 ? basicBlockers.map(b => `- ${b}`).join('\n') : '- No significant blockers'}

Determine range advantage, nut advantage for each street, and confirm/expand blocker analysis.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: ADVANTAGE_ANALYZER_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const advantages = JSON.parse(content) as AdvantageData;

        // Ensure blocker_effects is included
        if (!advantages.blocker_effects) {
            advantages.blocker_effects = {
                hero_blocks: basicBlockers,
                strategic_impact: basicBlockers.length > 0
                    ? 'Hero holds blockers that reduce villain\'s strong hand combos'
                    : 'No significant blocking effects'
            };
        }

        const duration = Date.now() - startTime;
        console.log(`[Agent 3: Advantage Analyzer] Completed in ${duration}ms`);

        return advantages;

    } catch (error) {
        console.error('[Agent 3: Advantage Analyzer] Error:', error);

        // Return fallback data
        return createFallbackAdvantages(input.boardAnalysis, basicBlockers);
    }
}

/**
 * Create fallback advantages if LLM call fails
 */
function createFallbackAdvantages(board: BoardAnalysis, blockers: string[]): AdvantageData {
    return {
        flop: {
            range_advantage: {
                leader: 'even',
                percentage: 'Even 50-50',
                reason: 'Unable to analyze - assuming even'
            },
            nut_advantage: {
                leader: 'hero',
                hero_strongest: 'Unknown',
                villain_strongest: 'Unknown',
                reason: 'Preflop raiser typically has nut advantage'
            }
        },
        blocker_effects: {
            hero_blocks: blockers,
            strategic_impact: blockers.length > 0
                ? 'Hero holds some blocking cards'
                : 'No significant blockers identified'
        }
    };
}

// Export for testing
export { extractHeroCards, analyzeBlockersBasic, ADVANTAGE_ANALYZER_PROMPT };
