/**
 * Agent 0: Board Analyzer
 * 
 * PURPOSE: Analyze poker board texture objectively
 * 
 * APPROACH: Code-first, LLM-fallback
 * - First tries deterministic code-based classification (fast, accurate)
 * - Falls back to LLM only for edge cases code can't handle
 * 
 * This agent is the FIRST in the pipeline. It looks at the community cards
 * and identifies:
 * - Board texture (paired, connected, suited)
 * - Possible draws (flush draws, straight draws)
 * - Scary cards (overcards, completed draws)
 * - How turn/river change the dynamics
 * 
 * RUNS: Tier 1 (first, before all other agents)
 * MODEL: GPT-4o (fallback only)
 * TIME: ~5ms (code) or ~500ms (LLM fallback)
 */

import OpenAI from 'openai';
import { Agent0Input, BoardAnalysis } from '../types/agentContracts';
import { classifyBoard, toBoardAnalysis } from '../utils/boardClassifier';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Lazy OpenAI client getter (for testing scenarios where env loads after import)
function getOpenAI(): OpenAI {
    return openai;
}

// System prompt for board analysis - focused and short
const BOARD_ANALYZER_SYSTEM_PROMPT = `You are a poker board texture analyzer. Your ONLY job is to analyze community cards objectively.

You will receive a poker board (flop, possibly turn and river).

Return a JSON object with this exact structure:
{
  "flop": {
    "cards": "exact flop cards",
    "texture": "description (e.g., 'K-high, rainbow, uncoordinated')",
    "draws_possible": ["list of possible draws"],
    "scary_for": "who should be scared of this board"
  },
  "turn": {
    "card": "turn card",
    "impact": "how this changes things",
    "range_shift": "who benefits from this card"
  },
  "river": {
    "card": "river card", 
    "impact": "how this changes things"
  },
  "summary": {
    "is_paired": true/false,
    "flush_possible": true/false,
    "straight_possible": true/false,
    "high_cards": ["A", "K", etc]
  }
}

RULES:
1. Be OBJECTIVE - don't recommend strategy, just describe the board
2. Identify ALL possible draws (flush, straight, gutshot, backdoor)
3. Note which cards are "scary" (overcards, completing draws)
4. If no turn/river provided, omit those fields
5. Always include the summary section

TEXTURE DESCRIPTIONS:
- Rainbow = 3 different suits (no flush draw)
- Two-tone = 2 cards same suit (flush draw possible)
- Monotone = 3 cards same suit (flush possible)
- Paired = board has a pair
- Connected = consecutive cards (straight draw possible)
- Dry/Uncoordinated = no draws, disconnected
- Wet/Coordinated = many draws possible`;

/**
 * Parse board string into flop, turn, river
 * Handles formats like "K♠9♦5♣ A♠ 2♣" or "Ks9d5c As 2c"
 */
function parseBoardCards(board: string): { flop: string; turn?: string; river?: string } {
    // Remove extra spaces and split
    const cards = board.trim().split(/\s+/);

    if (cards.length >= 3) {
        const flop = cards.slice(0, 3).join(' ');
        const turn = cards[3] || undefined;
        const river = cards[4] || undefined;

        return { flop, turn, river };
    }

    // If we can't parse, return the whole thing as flop
    return { flop: board };
}

/**
 * Agent 0: Analyze Board State
 * 
 * Uses CODE-FIRST approach:
 * 1. Try deterministic classification (instant, accurate)
 * 2. Fall back to LLM only if code can't classify
 * 
 * @param input - Contains the board string
 * @returns BoardAnalysis - Structured analysis of the board
 */
export async function agent0_boardAnalyzer(input: Agent0Input): Promise<BoardAnalysis> {
    const startTime = Date.now();

    // CRITICAL FIX: If no board exists, return empty analysis immediately
    // This prevents analyzing hypothetical streets that never occurred
    if (!input.board || input.board.trim() === '') {
        console.log('[Agent 0: Board Analyzer] No board provided - skipping analysis');
        return createEmptyBoardAnalysis();
    }

    // ==========================================================================
    // STEP 1: Try code-based classification first (fast, accurate)
    // ==========================================================================
    const classification = classifyBoard(input.board);

    if (classification.type !== 'unknown') {
        // Code successfully classified the board - no LLM needed!
        const duration = Date.now() - startTime;
        console.log(`[Agent 0: Board Analyzer] Code classification completed in ${duration}ms - Type: ${classification.type}`);

        return toBoardAnalysis(input.board, classification);
    }

    // ==========================================================================
    // STEP 2: Edge case - fall back to LLM
    // ==========================================================================
    console.log('[Agent 0: Board Analyzer] Code classification failed, using LLM fallback');

    // Parse the board into components
    const { flop, turn, river } = parseBoardCards(input.board);

    // Build the prompt
    const userPrompt = `Analyze this poker board:

Flop: ${flop}
${turn ? `Turn: ${turn}` : '(no turn yet)'}
${river ? `River: ${river}` : '(no river yet)'}

Provide complete board texture analysis.`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: BOARD_ANALYZER_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1, // Low temperature for consistency
            max_tokens: 800,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const analysis = JSON.parse(content) as BoardAnalysis;

        // Log timing for debugging
        const duration = Date.now() - startTime;
        console.log(`[Agent 0: Board Analyzer] LLM fallback completed in ${duration}ms`);

        return analysis;

    } catch (error) {
        console.error('[Agent 0: Board Analyzer] LLM Error:', error);

        // Return a minimal valid response on error
        return createFallbackAnalysis(input.board, flop, turn, river);
    }
}

/**
 * Create empty board analysis when no board exists
 * Used when Hero folded preflop or didn't see postflop streets
 */
function createEmptyBoardAnalysis(): BoardAnalysis {
    return {
        summary: {
            is_paired: false,
            flush_possible: false,
            straight_possible: false,
            high_cards: []
        }
    };
}

/**
 * Create fallback analysis if LLM call fails
 */
function createFallbackAnalysis(
    originalBoard: string,
    flop: string,
    turn?: string,
    river?: string
): BoardAnalysis {
    const analysis: BoardAnalysis = {
        flop: {
            cards: flop,
            texture: 'Unable to analyze - please check board format',
            draws_possible: [],
            scary_for: 'unknown'
        },
        summary: {
            is_paired: false,
            flush_possible: false,
            straight_possible: false,
            high_cards: []
        }
    };

    if (turn) {
        analysis.turn = {
            card: turn,
            impact: 'Unable to analyze',
            range_shift: 'unknown'
        };
    }

    if (river) {
        analysis.river = {
            card: river,
            impact: 'Unable to analyze'
        };
    }

    return analysis;
}

// Export for testing
export { parseBoardCards, BOARD_ANALYZER_SYSTEM_PROMPT };
