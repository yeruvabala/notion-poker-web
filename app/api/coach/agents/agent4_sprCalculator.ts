/**
 * Agent 4: SPR Calculator
 * 
 * PURPOSE: Calculate Stack-to-Pot Ratio and commitment thresholds
 * 
 * This is the ONLY agent that does NOT use an LLM!
 * It's pure JavaScript math - fast, deterministic, no API costs.
 * 
 * SPR = Effective Stack / Pot Size
 * - High SPR (>10): Can fold even strong hands, lots of maneuvering room
 * - Medium SPR (4-10): Commit with top pair+, draw decisions matter
 * - Low SPR (<4): Pot committed with most made hands
 * 
 * RUNS: Tier 2 (parallel with Agent 1)
 * NEEDS: Pot sizes and stack sizes only
 * MODEL: NONE! Pure JavaScript
 * TOOLS: Basic math
 * TIME: ~5ms (instant!)
 */

import { Agent4Input, SPRData, PotSizes, Stacks } from '../types/agentContracts';

/**
 * Agent 4: Calculate SPR
 * 
 * This function is pure JavaScript - no async, no API calls!
 * Returns immediately with calculated SPR values.
 * 
 * @param input - Pot sizes and stack sizes
 * @returns SPRData - SPR per street and commitment analysis
 */
export function agent4_sprCalculator(input: Agent4Input): SPRData {
    const startTime = Date.now();

    const { potSizes, stacks } = input;

    // Calculate effective stack (minimum of hero and villain)
    const effectiveStack = Math.min(stacks.hero, stacks.villain);

    // Calculate SPR for each street where we have pot info
    const flopSPR = potSizes.flop ? effectiveStack / potSizes.flop : undefined;
    const turnSPR = potSizes.turn ? effectiveStack / potSizes.turn : undefined;
    const riverSPR = potSizes.river ? effectiveStack / potSizes.river : undefined;

    // Generate commitment analysis
    const commitmentAnalysis = analyzeCommitment(flopSPR, turnSPR, riverSPR);

    const duration = Date.now() - startTime;
    console.log(`[Agent 4: SPR Calculator] Completed in ${duration}ms`);

    return {
        effective_stack: effectiveStack,
        flop_spr: flopSPR,
        turn_spr: turnSPR,
        river_spr: riverSPR,
        commitment_analysis: commitmentAnalysis
    };
}

/**
 * Analyze commitment level based on SPR
 * 
 * SPR Commitment Guidelines (GTO):
 * - SPR > 13: Can fold overpairs, play very cautiously
 * - SPR 8-13: Commit with top pair top kicker+
 * - SPR 4-8: Commit with top pair+, draw decisions matter
 * - SPR 2-4: Getting committed, hard to fold made hands
 * - SPR < 2: Pot committed, should get stacks in with any piece
 */
function analyzeCommitment(
    flopSPR?: number,
    turnSPR?: number,
    riverSPR?: number
): { flop?: string; turn?: string; river?: string } {
    const analysis: { flop?: string; turn?: string; river?: string } = {};

    if (flopSPR !== undefined) {
        analysis.flop = getSPRAnalysis(flopSPR, 'flop');
    }

    if (turnSPR !== undefined) {
        analysis.turn = getSPRAnalysis(turnSPR, 'turn');
    }

    if (riverSPR !== undefined) {
        analysis.river = getSPRAnalysis(riverSPR, 'river');
    }

    return analysis;
}

/**
 * Get human-readable SPR analysis for a street
 */
function getSPRAnalysis(spr: number, street: string): string {
    if (spr > 13) {
        return `High SPR (${spr.toFixed(1)}) - Can fold even strong hands, room to maneuver`;
    } else if (spr > 8) {
        return `Medium-high SPR (${spr.toFixed(1)}) - Commit with TPTK+, careful with one pair`;
    } else if (spr > 4) {
        return `Medium SPR (${spr.toFixed(1)}) - Commit with top pair+, draw decisions matter`;
    } else if (spr > 2) {
        return `Low SPR (${spr.toFixed(1)}) - Getting committed, hard to fold made hands`;
    } else {
        return `Very low SPR (${spr.toFixed(1)}) - Pot committed with any made hand`;
    }
}

/**
 * Calculate pot geometry (bet sizing implications)
 * 
 * Helpful for understanding how bets affect stack-to-pot ratio
 */
export function calculatePotGeometry(
    pot: number,
    bet: number,
    remainingStack: number
): {
    new_pot: number;
    new_spr: number;
    pot_percentage: string;
    is_committed_after: boolean;
} {
    const newPot = pot + (bet * 2); // Both players put in the bet
    const newSPR = remainingStack / newPot;
    const potPercentage = ((bet / pot) * 100).toFixed(0);

    return {
        new_pot: newPot,
        new_spr: newSPR,
        pot_percentage: `${potPercentage}%`,
        is_committed_after: newSPR < 2
    };
}

/**
 * Helper: Calculate implied odds threshold
 * 
 * Returns how much we need to win to make a drawing call profitable
 */
export function calculateImpliedOddsThreshold(
    potSize: number,
    callAmount: number,
    equity: number
): {
    min_to_win: number;
    implied_odds_ratio: string;
    is_draw_profitable: boolean;
} {
    // How much we need to win for call to be profitable
    // EV = (equity * (pot + callAmount + impliedWinnings)) - ((1-equity) * callAmount) = 0
    // Solving: impliedWinnings = (callAmount * (1-equity) / equity) - pot

    const minToWin = (callAmount * (1 - equity) / equity) - potSize;
    const impliedRatio = minToWin > 0 ? (minToWin / potSize).toFixed(1) : '0';

    return {
        min_to_win: Math.max(0, minToWin),
        implied_odds_ratio: `${impliedRatio}x pot`,
        is_draw_profitable: minToWin <= 0 // Already profitable without implied odds
    };
}

// Export for testing
export { analyzeCommitment, getSPRAnalysis };
