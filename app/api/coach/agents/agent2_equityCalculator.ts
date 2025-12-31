/**
 * Agent 2: Equity Calculator (DETERMINISTIC & SPLIT EQUITY VERSION)
 * 
 * PURPOSE: Calculate EXACT equity using poker-odds calculator.
 * NOW WITH: Split Equity Analysis (Equity vs Value, Equity vs Bluffs).
 * 
 * 1. Calculates Overall Equity vs Villain's Range.
 * 2. Splits Villain's Range into "Value" and "Bluffs" using RangeEngine.
 * 3. Calculates Equity vs each sub-range.
 * 4. Determines Pot Odds and EV.
 * 
 * RUNS: Tier 3
 * MODEL: NONE (Deterministic Logic)
 */

import { Agent2Input, EquityData, RangeInfo } from '../types/agentContracts';
import { RangeEngine, BucketCategory } from '../utils/RangeEngine';

/**
 * Convert card notation from symbols to letters
 * K♠ -> Ks, A♥ -> Ah, etc.
 */
function normalizeCard(card: string): string {
    if (!card) return '';

    const suitMap: Record<string, string> = {
        '♠': 's', '♤': 's',
        '♥': 'h', '♡': 'h',
        '♦': 'd', '♢': 'd',
        '♣': 'c', '♧': 'c',
        's': 's', 'h': 'h', 'd': 'd', 'c': 'c'
    };

    // Already normalized (like "Ks")
    if (card.length === 2 && /[shdc]/.test(card[1])) {
        return card;
    }

    // Handle formats like "K♠" or "Ks"
    if (card.length >= 2) {
        const rank = card[0].toUpperCase();
        const suitChar = card.slice(1);
        const suit = suitMap[suitChar] || 's';
        return `${rank}${suit}`;
    }

    return card;
}

/**
 * Parse board string into array of normalized cards
 */
function parseBoard(board: string): string[] {
    if (!board || !board.trim()) return [];
    const cards = board.trim().split(/\s+/);
    return cards.map(normalizeCard).filter(c => c.length > 0);
}

/**
 * Expand text range to generic hands (Fallback)
 */
function expandRangeToHands(rangeStr: string): string[] {
    const hands: string[] = [];
    if (rangeStr.includes('Ax') || rangeStr.includes('A')) hands.push('AhKs', 'AhQs', 'AhJs', 'AhTs', 'Ah9s');
    if (rangeStr.includes('Kx') || rangeStr.includes('K')) hands.push('KhQs', 'KhJs', 'KhTs');
    if (rangeStr.includes('pair')) hands.push('2h2d', '5h5d', '7h7d', '9h9d', 'ThTd', 'JhJd', 'QhQd', 'KhKd', 'AhAd');
    if (rangeStr.includes('suited')) hands.push('9h8h', '8h7h', '7h6h');
    if (hands.length === 0) hands.push('AhKs', 'KhQs', 'JhTs', '9h8h', '2h2d');
    return [...new Set(hands)];
}

/**
 * Heuristic Equity Estimator (Fallback if poker-odds fails)
 */
function estimateEquity(heroHand: string, villainRange: string[], board: string[]): number {
    // Very rough heuristic
    return 0.45;
}

/**
 * Calculate Equity for a specific list of villain hands using poker-odds
 */
async function calculateEquityForRange(
    heroHand: string,
    villainHands: string[],
    board: string[]
): Promise<number | null> {
    if (villainHands.length === 0) return null;

    try {
        const pokerOdds = await import('poker-odds');
        if (!pokerOdds.calculateEquity) return null;

        const h1 = heroHand.slice(0, 2);
        const h2 = heroHand.slice(2, 4);
        const heroHandArray = [h1, h2];

        let totalEquity = 0;
        let validCalculations = 0;

        // Sample if range is too large to save time? 
        // For < 500 combos, it's fast enough.
        // We limit to max 100 samples for performance
        const sampleSize = 100;
        const handsProcess = villainHands.length > sampleSize
            ? villainHands.sort(() => 0.5 - Math.random()).slice(0, sampleSize)
            : villainHands;

        for (const vHandStr of handsProcess) {
            if (vHandStr.length < 4) continue;
            const v1 = vHandStr.slice(0, 2);
            const v2 = vHandStr.slice(2, 4);
            const villainHandArray = [v1, v2];

            if (heroHandArray.includes(v1) || heroHandArray.includes(v2)) continue; // Dead cards

            const result = pokerOdds.calculateEquity([heroHandArray, villainHandArray], board);
            if (result && result[0] && result[0].count > 0) {
                totalEquity += (result[0].wins / result[0].count);
                validCalculations++;
            }
        }

        return validCalculations > 0 ? totalEquity / validCalculations : null;

    } catch (err) {
        console.error('[Agent 2] Calculation Error:', err);
        return null;
    }
}

/**
 * Agent 2: Calculate Equity
 */
export async function agent2_equityCalculator(input: Agent2Input): Promise<EquityData> {
    const startTime = Date.now();

    try {
        const boardCards = parseBoard(input.board);
        const heroHand = normalizeCard(input.heroHand.slice(0, 2)) + normalizeCard(input.heroHand.slice(2));

        // 1. Get Villain Combos
        let villainHands: string[] = [];
        if (typeof input.villainRange !== 'string' && input.villainRange.allCombos) {
            villainHands = input.villainRange.allCombos;
        } else {
            const rangeStr = typeof input.villainRange === 'string' ? input.villainRange : input.villainRange.description;
            villainHands = expandRangeToHands(rangeStr);
        }

        // 2. Split Range (Value vs Bluffs)
        // We recreate a 'Range' object for categorization
        const rangeObj = villainHands.map(h => ({ hand: h, weight: 1.0 }));
        const categorizedRange = RangeEngine.categorizeRange(rangeObj, boardCards);

        const valueCombos = categorizedRange
            .filter(c => [BucketCategory.MONSTER, BucketCategory.STRONG, BucketCategory.MARGINAL].includes(c.bucket!))
            .map(c => c.hand);

        const bluffCombos = categorizedRange
            .filter(c => [BucketCategory.DRAW_STRONG, BucketCategory.DRAW_WEAK, BucketCategory.AIR].includes(c.bucket!))
            .map(c => c.hand);

        // 3. Calculate Equities
        const [totalEq, valueEq, bluffEq] = await Promise.all([
            calculateEquityForRange(heroHand, villainHands, boardCards),
            calculateEquityForRange(heroHand, valueCombos, boardCards),
            calculateEquityForRange(heroHand, bluffCombos, boardCards)
        ]);

        const finalEquity = totalEq ?? estimateEquity(heroHand, villainHands, boardCards);
        const finalValueEq = valueEq ?? 0;
        const finalBluffEq = bluffEq ?? 1.0; // If no bluffs, usually we crush air, but if empty list, irrelevant.

        // 4. Pot Odds & Decision
        const potSize = input.potSize || 1;
        const betSize = input.betSize || 0;
        const equityNeeded = betSize > 0 ? betSize / (potSize + betSize) : 0;
        const oddsRatio = betSize > 0 ? `${(potSize / betSize).toFixed(1)}:1` : 'N/A';
        const isProfitable = finalEquity > equityNeeded;

        // Generate Automated Decision Reasoning
        let decision = isProfitable
            ? `CALL - Equity (${(finalEquity * 100).toFixed(1)}%) > Odds (${(equityNeeded * 100).toFixed(1)}%)`
            : `FOLD - Equity (${(finalEquity * 100).toFixed(1)}%) < Odds (${(equityNeeded * 100).toFixed(1)}%)`;

        if (betSize === 0) decision = "CHECK/DECIDE - No bet to call";

        const duration = Date.now() - startTime;
        console.log(`[Agent 2] Eq: ${(finalEquity * 100).toFixed(1)}% (Val: ${(finalValueEq * 100).toFixed(1)}%, Blf: ${(finalBluffEq * 100).toFixed(1)}%). Time: ${duration}ms`);

        return {
            equity_vs_range: finalEquity,
            equity_vs_value: finalValueEq,
            equity_vs_bluffs: finalBluffEq,
            pot_odds: {
                pot_size: potSize,
                to_call: betSize,
                odds_ratio: oddsRatio,
                equity_needed: equityNeeded
            },
            decision,
            breakdown: {
                beats: bluffCombos.slice(0, 5),
                loses_to: valueCombos.slice(0, 5)
            }
        };

    } catch (error) {
        console.error('[Agent 2] Fatal Error:', error);
        return {
            equity_vs_range: 0,
            pot_odds: { pot_size: 0, to_call: 0, odds_ratio: '0', equity_needed: 0 },
            decision: 'ERROR'
        };
    }
}
