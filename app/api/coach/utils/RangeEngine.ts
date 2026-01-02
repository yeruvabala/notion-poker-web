/**
 * Range Engine: "The Range Reactor"
 * 
 * A deterministic, algorithmic engine to calculate Villain's range.
 * Replaces LLM "guessing" with Set Theory and Poker Logic Filters.
 */

import { evaluateHand, HandEvaluation } from './handEvaluator';
import { getPreflopAction, normalizeHand, getOpeningFrequency, getVs3BetAction, getVs4BetAction, getMaking3BetAction, getColdCallAction } from './gtoRanges';
import { getHandType } from '../utils/handUtils';
import { classifyBoard } from './boardClassifier';
import { PreflopClassifier, HandClassification } from './PreflopClassifier';

// =============================================================================
// DATA STRUCTURES
// =============================================================================

export interface RangeCombo {
    hand: string;      // "AhKh"
    weight: number;    // 0.0 to 1.0 (frequency)
    bucket?: BucketCategory; // Current strength bucket
}

export type Range = RangeCombo[];

export enum BucketCategory {
    MONSTER = 'monster',       // Sets, Straights, Flushes, Quads
    STRONG = 'strong',         // Top Pair Top Kicker, Overpairs
    MARGINAL = 'marginal',     // Middle Pair, Weak Top Pair, Bottom Pair
    DRAW_STRONG = 'draw_strong', // 8+ outs (Flush draw, OESD, Combo Draw)
    DRAW_WEAK = 'draw_weak',   // Gutshots, Backdoor equity
    AIR = 'air',               // Missed hands, underpairs
}

export interface RangeStats {
    totalCombos: number;
    distribution: Record<BucketCategory, number>; // Percentage 0-100
    topHands: string[];
    allCombos?: string[]; // Full list of hands with weight > 0
}

export interface AdvantageMetrics {
    heroRangeAdvantage: number; // +20 means Hero has 20% more equity/strength
    nutAdvantage: 'hero' | 'villain' | 'neutral';
    textureFlags: TextureFlag[];
}

export type TextureFlag = 'FLUSH_COMPLETED' | 'STRAIGHT_COMPLETED' | 'BOARD_PAIRED' | 'SCARY_OVERCARD';

// =============================================================================
// CORE CLASS
// =============================================================================

export class RangeEngine {

    /**
     * Initialize a range based on Preflop Action and Position
     * Uses gtoRanges.ts as the Source of Truth
     */
    static initializeRange(
        heroPosition: string,
        villainPosition: string,
        actionType: 'open' | 'call_open' | '3bet' | 'call_3bet' | 'limp' | '4bet' | 'call_4bet'
    ): Range {
        const allHands = getAllPossibleHands();
        const initialRange: Range = [];

        for (const hand of allHands) {
            let weight = 0;
            const normalized = normalizeHand(hand);

            // Logic to fetch frequency from gtoRanges
            // This is a simplified mapping for the MVP
            // We will expand this to query specific gtoRanges functions
            if (actionType === 'call_open') {
                // Villain (Caller) calls an Open Raise from Hero (Opener)
                // We use getColdCallAction(Hand, VillainPos, HeroPos)
                // Note: villainPosition is the Caller (active). heroPosition is the Opener.
                const result = getColdCallAction(hand, villainPosition, heroPosition);

                if (result.found) {
                    if ((result.action.action as string) === 'call') {
                        weight = result.action.frequency;
                    }
                } else {
                    // Fallback to old heuristic if range not found (e.g. BB defense might be special?)
                    // BB defense is in THREE_BET_RANGES ('BB_vs_BTN', etc.) so it should be found.
                    const openFreq = getOpeningFrequency(hand, villainPosition);
                    if (openFreq > 0.1 && openFreq < 0.9) weight = 0.8;
                    else if (openFreq >= 0.9) weight = 0.2;
                    else weight = 0;
                }

            } else if (actionType === 'open') {
                weight = getOpeningFrequency(hand, villainPosition);

            } else if (actionType === '3bet') {
                // Hero (or Villain in this context) MAKES a 3-bet.
                // We want to know "What is the probability this hand is in their 3-betting range?"
                // Opener (Victim) vs 3-Bettor (Aggressor)
                // getMaking3BetAction(Hand, 3BettorPos, OpenerPos)
                // In initializeRange(heroPos, villainPos, actionType):
                // 'heroPosition' is usually the POV player. 'villainPosition' is the one acting.
                // Wait. initializeRange is creating a range for "Villain".
                // So 'villainPosition' is the ACTIVE player (the 3-Bettor).
                // 'heroPosition' must be the Opener (who is facing it).

                // Let's assume initializeRange(heroPos, villainPos) means:
                // "Calculate the range for 'villainPosition' who is acting against 'heroPosition'"
                const result = getMaking3BetAction(hand, villainPosition, heroPosition);
                // Note: heroPosition here is the Opener. villainPosition is the 3-bettor.

                if (result.found) {
                    if ((result.action.action as string) === '3bet') {
                        weight = result.action.frequency;
                    }
                    // If action is mixed (call/3bet), we use 3bet freq.
                    // If dominant is call, but there is 3bet freq, we use it. 
                    // getMaking3BetAction returns { action: '3bet', frequency: X } if X > 0.
                    // So we are good.
                }

            } else if (actionType === 'call_3bet') {
                // Villain (Opener) called a 3-bet from Hero (Aggr)
                // We need Villain's defense range vs Hero's 3-bet
                // getVs3BetAction(hand, VillainPos, HeroPos)
                // Villain is the one holding the hand (The "Hero" in gtoRanges terminology)
                // Hero is the 3-bettor (The "ThreeBettor" in gtoRanges)
                const result = getVs3BetAction(hand, villainPosition, heroPosition);
                if (result.found) {
                    if ((result.action.action as string) === 'call') {
                        weight = result.action.frequency;
                    } else {
                        // If action is mixed (some call, some 4bet), weight is call freq
                        // getVs3BetAction returns dominant strategy but we might want raw frequencies?
                        // getVs3BetAction returns 'action' and 'frequency' of dominant.
                        // But Agent 5 uses it for decision. Range Builder needs FREQUENCY of calling.
                        // Ideally we access the raw range. getVs3BetAction abstracts it.
                        // For MVP: If dominant action is CALL, use freq. If dominant is 4BET, assume call is 0?
                        // Actually, getVs3BetAction returns the highest frequency action.
                        // If it says 'Call 0.4', it means Call is the best option? Or just 40%?
                        // It means Call 40% is the highest freq option (vs Fold or 4bet).
                        // Wait. If Fold is 0.5, Call 0.4, 4bet 0.1.
                        // getVs3BetAction returns Fold.
                        // But here we are building the range of a player who *DID* call.
                        // So we simply want "What is the probability this hand is in the calling range?"
                        // We need access to the Raw Frequency, not just the Best Action.
                        // Does getVs3BetAction provide that? No.
                        // It returns { action: 'call', frequency: 0.4 } implies 0.4 call.
                        // But if action is 'fold', it returns fold/1.0.
                        // Limitation: We can't see the secondary frequencies.
                        // However, for this upgrade, we will use what we have.
                        // If action is 'call', weight = freq.
                        // If action is '4bet', weight = (1 - freq)? No, could be folding.
                        // We will set weight = 1.0 if action is 'call', else 0.
                        // Better: If action is 'call', use frequency.
                        if (result.action.action === 'call') weight = result.action.frequency;
                    }
                } else {
                    // Fallback to top range
                    const openFreq = getOpeningFrequency(hand, villainPosition);
                    if (openFreq > 0.5) weight = 1.0;
                }

            } else if (actionType === '4bet') {
                // Villain 4-bets (after Hero 3-bets)
                const result = getVs3BetAction(hand, villainPosition, heroPosition);
                if (result.found && result.action.action === '4bet') {
                    weight = result.action.frequency;
                }

            } else if (actionType === 'call_4bet') {
                // Villain calls a 4-bet (after Hero 4-bets)
                // Villain (3-bettor) vs Hero (4-bettor)
                const result = getVs4BetAction(hand, villainPosition, heroPosition);
                if (result.found && result.action.action === 'call') {
                    weight = result.action.frequency;
                }
            }

            if (weight > 0) {
                initialRange.push({ hand, weight });
            }
        }

        return initialRange;
    }

    /**
     * Apply Card Removal (Hero cards + Board cards)
     * Sets weight to 0 for any combo containing dead cards
     */
    static applyCardRemoval(range: Range, deadCards: string[]): Range {
        // Normalize dead cards to 2-char format (e.g. "Ah")
        const normalizedDead = deadCards.map(c => normalizeCard(c));

        return range.map(combo => {
            const c1 = combo.hand.slice(0, 2);
            const c2 = combo.hand.slice(2, 4);

            if (normalizedDead.includes(c1) || normalizedDead.includes(c2)) {
                return { ...combo, weight: 0 };
            }
            return combo;
        }).filter(c => c.weight > 0);
    }

    /**
     * Categorize all hands in the range based on the current board
     * Returns the range with 'bucket' property populated
     */
    static categorizeRange(range: Range, boardCards: string[]): Range {
        const boardStr = boardCards.join(' ');

        return range.map(combo => {
            const bucket = this.categorizeHand(combo.hand, boardStr);
            return { ...combo, bucket };
        });
    }

    /**
     * Categorize a preflop hand without board
     */
    static categorizePreflopHand(hand: string): HandClassification {
        return PreflopClassifier.classify(hand);
    }

    /**
     * Helper: Categorize a single hand
     */
    private static categorizeHand(hand: string, boardStr: string): BucketCategory {
        const evalResult = evaluateHand(hand, boardStr);

        // Logic to map HandEvaluation to BucketCategory
        // 1. Monsters
        if (
            evalResult.detailed.is_flush_draw && evalResult.made_hand.includes("Flush") || // Already made flush
            evalResult.made_hand.includes("Straight") ||
            evalResult.made_hand.includes("Set") ||
            evalResult.made_hand.includes("Quads") ||
            evalResult.made_hand.includes("Full House") ||
            (evalResult.detailed.is_paired && evalResult.made_hand.includes("Two Pair") && isTopTwo(hand, boardStr)) // Top Two
        ) {
            return BucketCategory.MONSTER;
        }

        // 2. Strong
        if (
            evalResult.made_hand.includes("Two Pair") || // Bottom two
            evalResult.made_hand.includes("Overpair") ||
            (evalResult.detailed.is_paired && isTopPairTopKicker(hand, boardStr))
        ) {
            return BucketCategory.STRONG;
        }

        // 3. Strong Draws
        if (
            (evalResult.detailed.is_flush_draw && evalResult.outs >= 9) ||
            (evalResult.detailed.is_oesd && evalResult.outs >= 8) ||
            (evalResult.outs >= 8) // Combo draws
        ) {
            return BucketCategory.DRAW_STRONG;
        }

        // 4. Marginal
        if (
            evalResult.detailed.is_paired || // Any other pair
            evalResult.made_hand.includes("High Card Ace") // Strong Ace high
        ) {
            return BucketCategory.MARGINAL;
        }

        // 5. Weak Draws
        if (
            evalResult.detailed.is_gutshot ||
            (evalResult.outs >= 3 && evalResult.outs < 8)
        ) {
            return BucketCategory.DRAW_WEAK;
        }

        // 6. Air
        return BucketCategory.AIR;
    }

    /**
     * Apply Action Filter: Filter the range based on Villain's action
     * REFINED: Now uses Board Texture to determine Polarized vs Merged strategies
     */
    static applyActionFilter(
        range: Range,
        action: 'check' | 'bet' | 'raise' | 'call',
        isPreflopAggressor: boolean, // Did villain have initiative?
        board?: string // NEW: Board context for texture detection
    ): Range {
        // 1. Classify Board Texture (if available)
        let isWetBoard = false;
        if (board) {
            const classification = classifyBoard(board);
            // "Wet" = Dynamic, Connected, or Two-Tone
            if (classification.type === 'dynamic' ||
                classification.isConnected ||
                classification.suitPattern !== 'rainbow') {
                isWetBoard = true;
            }
        }

        return range.map(combo => {
            let newWeight = combo.weight;
            const bucket = combo.bucket;

            if (action === 'raise') { // Aggressive
                if (isWetBoard) {
                    // WET BOARD: Merged Range
                    // Raises for protection with Strong hands (TPTK, Overpairs) + Draws
                    if (bucket === BucketCategory.MARGINAL) newWeight *= 0.2; // Some protection raises
                    if (bucket === BucketCategory.STRONG) newWeight *= 0.8;   // High freq raise for protection
                    if (bucket === BucketCategory.MONSTER) newWeight *= 1.0;
                    if (bucket === BucketCategory.DRAW_STRONG) newWeight *= 1.0; // Fast play draws
                    if (bucket === BucketCategory.AIR) newWeight *= 0.2; // Less clean bluffs available
                } else {
                    // DRY BOARD: Polarized Range
                    // Nuts or Air. Minimal "Protection" raising.
                    if (bucket === BucketCategory.MARGINAL) newWeight *= 0.05; // Rarely raise mid-pair
                    if (bucket === BucketCategory.STRONG) newWeight *= 0.2;    // Call strong hands (trap/pot control)
                    if (bucket === BucketCategory.MONSTER) newWeight *= 1.0;
                    if (bucket === BucketCategory.DRAW_STRONG) newWeight *= 1.0;
                    if (bucket === BucketCategory.AIR) newWeight *= 0.4; // More bluffs required to balance
                }
            }
            else if (action === 'call') { // Passive
                // Condensed: No Air, No super nuts (usually)
                if (bucket === BucketCategory.AIR) newWeight *= 0.05; // Rarely call air
                if (bucket === BucketCategory.MONSTER) newWeight *= 0.6; // Slowplay some, raise others

                if (isWetBoard) {
                    // On wet boards, you MUST call with draws
                    if (bucket === BucketCategory.DRAW_STRONG) newWeight *= 0.9;
                    // You fold marginal hands more often
                    if (bucket === BucketCategory.MARGINAL) newWeight *= 0.4;
                } else {
                    // On dry boards, you can float/call wider
                    if (bucket === BucketCategory.MARGINAL) newWeight *= 0.8;
                }

                if (bucket === BucketCategory.STRONG) newWeight *= 1.0;
            }
            else if (action === 'check') {
                if (isPreflopAggressor) {
                    // C-Bet opportunity missed -> Weakness/Pot Control/Trap
                    if (bucket === BucketCategory.MONSTER) newWeight *= 0.3; // Slowplay
                    if (bucket === BucketCategory.STRONG) newWeight *= 0.5; // Pot control or Bet
                    if (bucket === BucketCategory.MARGINAL) newWeight *= 1.0; // Check back
                    if (bucket === BucketCategory.AIR) newWeight *= 1.0; // Give up
                } else {
                    // Checking to aggressor -> Standard, keeps everything
                }
            }

            return { ...combo, weight: newWeight };
        }).filter(c => c.weight > 0.01);
    }

    /**
     * Apply Stack Depth Filter (Phase 8: New for MVP)
     * Filters range based on Effective Stack Size (BB)
     * 
     * Logic:
     * - Short Stack (< 30BB): Remove speculative hands (SC, small pairs). Bind to High Cards.
     * - Deep Stack (> 150BB): Boost implied odds hands (SC, Sets).
     */
    static applyStackFilter(range: Range, effectiveStackBB: number): Range {
        // No filter for standard stacks (30-150bb)
        if (effectiveStackBB >= 30 && effectiveStackBB <= 150) {
            return range;
        }

        const isShortStack = effectiveStackBB < 30;
        const isDeepStack = effectiveStackBB > 150;

        return range.map(combo => {
            let newWeight = combo.weight;
            const hand = combo.hand; // e.g. "AhKh"

            // Heuristic Parsing of Hand (Simple extraction)
            // Better to use normalized string checks if available, but raw string check works for MVP
            let isSuited = false;
            if (hand.length === 4) isSuited = hand[1] === hand[3]; // Raw: AhKh
            if (hand.length === 3) isSuited = hand.endsWith('s');  // Norm: AKs

            const isPair = hand[0] === hand[Math.floor(hand.length / 2)]; // e.g. "AhAs" (0 vs 2) or "AA" (0 vs 1)

            // SHORT STACK LOGIC (< 30BB)
            if (isShortStack) {
                // Penalize Speculative Hands (Suited Connectors, Small Pairs < 77)
                // Boost High Cards (Ax, Kx)
                if (isPair) {
                    // Small pairs are bad
                    if ('23456'.includes(hand[0])) newWeight *= 0.2;
                } else {
                    // High cards are good
                    if (hand.includes('A') || hand.includes('K')) newWeight *= 1.2;
                    // Suited connectors (low) are bad
                    if (!hand.includes('A') && !hand.includes('K') && !hand.includes('Q')) newWeight *= 0.3;
                }
            }

            // DEEP STACK LOGIC (> 150BB)
            if (isDeepStack) {
                // Boost Speculative Hands (Implied Odds)
                if (isSuited) newWeight *= 1.2;
                if (isPair) {
                    // Set mining is valuable
                    if ('23456789'.includes(hand[0])) newWeight *= 1.2;
                }
                // Penalize offsuit broadways (Reverse Implied Odds)
                if (!isSuited && !isPair && hand.includes('A') && hand.includes('J')) newWeight *= 0.8; // AJo type hands
            }

            // Cap weight at 1.0 (some boosts might exceed)
            return { ...combo, weight: Math.min(1.0, newWeight) };
        });
    }

    /**
     * Get statistics for the current range
     */
    /**
     * Get statistics for the current range
     */
    static getStats(range: Range): RangeStats {
        let totalCombos = 0;
        const counts: Record<BucketCategory, number> = {
            [BucketCategory.MONSTER]: 0,
            [BucketCategory.STRONG]: 0,
            [BucketCategory.MARGINAL]: 0,
            [BucketCategory.DRAW_STRONG]: 0,
            [BucketCategory.DRAW_WEAK]: 0,
            [BucketCategory.AIR]: 0
        };

        const allCombos: string[] = [];

        for (const c of range) {
            totalCombos += c.weight;
            if (c.bucket) {
                counts[c.bucket] += c.weight;
            }
            if (c.weight > 0.05) {
                allCombos.push(c.hand);
            }
        }

        // Determine top hands (by weight)
        const topHands = range
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10)
            .map(c => c.hand);

        // Normalize distribution percentages
        const distribution: any = {};
        for (const key of Object.keys(counts)) {
            const k = key as BucketCategory;
            distribution[k] = totalCombos > 0 ? (counts[k] / totalCombos) * 100 : 0;
        }

        return {
            totalCombos,
            distribution,
            topHands,
            allCombos // NEW: Full list for Agent 2
        };
    }
}

// =============================================================================
// HELPERS
// =============================================================================

function getAllPossibleHands(): string[] {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const suits = ['s', 'h', 'd', 'c'];
    const hands: string[] = [];
    const deck: string[] = [];

    // Generate Deck
    for (const r of ranks) {
        for (const s of suits) {
            deck.push(r + s);
        }
    }

    // Generate Combinations
    for (let i = 0; i < deck.length; i++) {
        for (let j = i + 1; j < deck.length; j++) {
            hands.push(deck[i] + deck[j]); // e.g. "AsAh"
        }
    }

    return hands;
}

function normalizeCard(c: string): string {
    if (c.length < 2) return c;
    // Ensure "Ah" format
    return c[0].toUpperCase() + c[1].toLowerCase();
}

const RANK_MAP: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

function getRank(card: string): number {
    return RANK_MAP[card[0].toUpperCase()] || 0;
}

function parseBoardRanks(board: string): number[] {
    if (!board) return [];
    return board.split(' ').map(c => getRank(c)).sort((a, b) => b - a);
}

function isTopTwo(hand: string, board: string): boolean {
    const boardRanks = parseBoardRanks(board);
    if (boardRanks.length < 2) return false;

    const r1 = getRank(hand.slice(0, 2));
    const r2 = getRank(hand.slice(2, 4));

    // Hero must use both hole cards to make two pair
    // And those cards must match the top 2 board cards
    return (r1 === boardRanks[0] && r2 === boardRanks[1]) ||
        (r1 === boardRanks[1] && r2 === boardRanks[0]);
}

function isTopPairTopKicker(hand: string, board: string): boolean {
    const boardRanks = parseBoardRanks(board);
    if (boardRanks.length === 0) return false;

    const topBoard = boardRanks[0];
    const r1 = getRank(hand.slice(0, 2));
    const r2 = getRank(hand.slice(2, 4));

    // Must match top board card
    const matchesTop = (r1 === topBoard) || (r2 === topBoard);
    if (!matchesTop) return false;

    // Kicker must be Ace or King (unless board is Ace)
    const kicker = (r1 === topBoard) ? r2 : r1;

    if (topBoard === 14) return kicker >= 13; // On Ace high board, TP(A) requires King kicker? No, usually "Top Pair" is just pair of Aces.

    return kicker === 14;
}

export function calculateRangeAdvantage(heroRange: Range, villainRange: Range): AdvantageMetrics {
    // Safety check
    if (!heroRange.length || !villainRange.length) {
        return { heroRangeAdvantage: 0, nutAdvantage: 'neutral', textureFlags: [] };
    }

    const heroScore = calculateScore(heroRange);
    const villainScore = calculateScore(villainRange);

    // Simple heuristic: Monster=10, Strong=5, Marginal=2
    const totalScore = heroScore + villainScore;
    const advantage = totalScore > 0 ? ((heroScore - villainScore) / totalScore) * 100 : 0;

    return {
        heroRangeAdvantage: advantage,
        nutAdvantage: advantage > 5 ? 'hero' : advantage < -5 ? 'villain' : 'neutral',
        textureFlags: []
    };
}

function calculateScore(range: Range): number {
    let score = 0;
    for (const c of range) {
        if (c.bucket === BucketCategory.MONSTER) score += c.weight * 10;
        else if (c.bucket === BucketCategory.STRONG) score += c.weight * 5;
        else if (c.bucket === BucketCategory.MARGINAL) score += c.weight * 2;
        else if (c.bucket === BucketCategory.DRAW_STRONG) score += c.weight * 3;
    }
    return score;
}

export function detectTextureShift(prevBoard: string, currBoard: string): TextureFlag[] {
    const flags: TextureFlag[] = [];
    const prevRanks = parseBoardRanks(prevBoard);
    const currRanks = parseBoardRanks(currBoard);

    // Board Pair Check
    // If prev had unique ranks, and curr has duplicate
    const prevUnique = new Set(prevRanks).size === prevRanks.length;
    const currUnique = new Set(currRanks).size === currRanks.length;

    if (prevUnique && !currUnique) {
        flags.push('BOARD_PAIRED');
    }

    // Flush Check - Placeholder for now until we parse suits fully
    // We would need to count suits on prevBoard vs currBoard

    return flags;
}
