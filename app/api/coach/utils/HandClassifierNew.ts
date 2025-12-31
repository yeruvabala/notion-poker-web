/**
 * Hand Classifier - 2D Postflop Bucketing System
 * 
 * Classifies hero's hand into a 2D bucket based on:
 * 1. Made Hand Strength (0-5): How strong is the made hand?
 * 2. Draw Strength (0-3): How strong are the draws?
 * 
 * This enables code-based postflop decision context instead of LLM guessing.
 * 
 * Made Hand Levels:
 * 0 = No made hand (air)
 * 1 = Weak pair (low pair, underpair)
 * 2 = Medium pair (middle pair, weak top pair)
 * 3 = Strong pair (top pair good kicker, overpair)
 * 4 = Two pair or set
 * 5 = Strong made (straight, flush, full house+)
 * 
 * Draw Levels:
 * 0 = No draw
 * 1 = Weak draw (gutshot, backdoor)
 * 2 = Strong draw (OESD, flush draw)
 * 3 = Combo draw (flush + straight, pair + draw)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface HandClassification {
    madeHand: number;        // 0-5
    drawStrength: number;    // 0-3
    bucket2D: string;        // e.g., "(3,2)" for strong pair + strong draw
    description: string;     // Human readable
    details: {
        madeHandType: string;    // "top_pair", "set", "flush", etc.
        draws: string[];         // ["flush_draw", "gutshot"]
        kicker: string;          // "strong", "weak", "none"
    };
}

interface ParsedCard {
    rank: string;
    suit: string;
    rankValue: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RANK_VALUES: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_NAMES: Record<number, string> = {
    14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
    9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
    4: 'Four', 3: 'Three', 2: 'Two'
};

// =============================================================================
// CARD PARSING
// =============================================================================

function parseCard(cardStr: string): ParsedCard | null {
    const cleaned = cardStr.trim().toUpperCase();
    if (cleaned.length < 2) return null;

    const rank = cleaned[0];
    let suit = cleaned[1];

    // Normalize suit symbols
    const suitMap: Record<string, string> = {
        '♠': 's', 'S': 's',
        '♥': 'h', 'H': 'h',
        '♦': 'd', 'D': 'd',
        '♣': 'c', 'C': 'c',
    };
    suit = suitMap[suit] || suit.toLowerCase();

    const rankValue = RANK_VALUES[rank];
    if (!rankValue) return null;

    return { rank, suit, rankValue };
}

function parseCards(cardsStr: string): ParsedCard[] {
    const cards: ParsedCard[] = [];
    const parts = cardsStr.trim().split(/\s+/);

    for (const part of parts) {
        const card = parseCard(part);
        if (card) cards.push(card);
    }

    // Handle no-space format like "AhKh"
    if (cards.length === 0) {
        const cleaned = cardsStr.replace(/\s/g, '');
        for (let i = 0; i < cleaned.length - 1; i += 2) {
            const card = parseCard(cleaned.substring(i, i + 2));
            if (card) cards.push(card);
        }
    }

    return cards;
}

// =============================================================================
// MADE HAND EVALUATION
// =============================================================================

interface MadeHandResult {
    level: number;
    type: string;
    kicker: string;
    description: string;
}

/**
 * Evaluate made hand strength (0-5)
 */
function evaluateMadeHand(heroCards: ParsedCard[], boardCards: ParsedCard[]): MadeHandResult {
    const allCards = [...heroCards, ...boardCards];
    const heroRanks = heroCards.map(c => c.rankValue);
    const boardRanks = boardCards.map(c => c.rankValue);
    const allRanks = allCards.map(c => c.rankValue);
    const allSuits = allCards.map(c => c.suit);

    // Count ranks
    const rankCounts: Record<number, number> = {};
    for (const rank of allRanks) {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    }

    // Count suits
    const suitCounts: Record<string, number> = {};
    for (const suit of allSuits) {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    }

    // Check for flush (5+ same suit)
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    if (maxSuitCount >= 5) {
        return { level: 5, type: 'flush', kicker: 'strong', description: 'Flush' };
    }

    // Check for straight
    if (hasStraight(allRanks)) {
        return { level: 5, type: 'straight', kicker: 'strong', description: 'Straight' };
    }

    // Check for trips/set
    for (const [rank, count] of Object.entries(rankCounts)) {
        if (count >= 3) {
            const rankVal = parseInt(rank);
            const isPocketPair = heroRanks[0] === heroRanks[1] && heroRanks[0] === rankVal;
            if (isPocketPair) {
                return { level: 4, type: 'set', kicker: 'strong', description: 'Set' };
            }
            return { level: 4, type: 'trips', kicker: 'medium', description: 'Trips' };
        }
    }

    // Check for two pair
    const pairs = Object.entries(rankCounts).filter(([_, count]) => count >= 2);
    if (pairs.length >= 2) {
        // Check if hero has both pairs
        const heroPairs = pairs.filter(([rank]) =>
            heroRanks.includes(parseInt(rank))
        );
        if (heroPairs.length >= 2) {
            return { level: 4, type: 'two_pair', kicker: 'strong', description: 'Two pair (both cards)' };
        }
        if (heroPairs.length === 1) {
            return { level: 4, type: 'two_pair', kicker: 'medium', description: 'Two pair (one card)' };
        }
    }

    // Check for one pair
    if (pairs.length === 1) {
        const pairRank = parseInt(pairs[0][0]);
        const heroHasPair = heroRanks.includes(pairRank);

        // Check if hero has a pocket pair (both hero cards are the same rank)
        const heroPocketPairRank = heroRanks[0] === heroRanks[1] ? heroRanks[0] : null;

        if (heroPocketPairRank !== null) {
            // Hero has a pocket pair
            const highBoardCard = Math.max(...boardRanks);

            // Check if pocket pair is on the board (which would mean trips, handled above)
            const pocketPairOnBoard = boardRanks.includes(heroPocketPairRank);

            if (!pocketPairOnBoard) {
                // Pure pocket pair vs board
                if (heroPocketPairRank > highBoardCard) {
                    return { level: 3, type: 'overpair', kicker: 'strong', description: 'Overpair' };
                }
                return { level: 1, type: 'underpair', kicker: 'weak', description: 'Underpair' };
            }
        }

        if (heroHasPair && heroPocketPairRank === null) {
            // Hero hit a pair on the board (not pocket pair)
            const highBoardCard = Math.max(...boardRanks);
            const otherHeroCard = heroRanks.find(r => r !== pairRank) || 0;

            // Top pair?
            if (pairRank === highBoardCard) {
                // Check kicker
                if (otherHeroCard >= 12) {
                    return { level: 3, type: 'top_pair', kicker: 'strong', description: 'Top pair strong kicker' };
                } else if (otherHeroCard >= 9) {
                    return { level: 2, type: 'top_pair', kicker: 'medium', description: 'Top pair medium kicker' };
                }
                return { level: 2, type: 'top_pair', kicker: 'weak', description: 'Top pair weak kicker' };
            }

            // Middle/bottom pair
            const sortedBoard = [...boardRanks].sort((a, b) => b - a);
            if (boardRanks.length >= 2 && pairRank === sortedBoard[1]) {
                return { level: 1, type: 'middle_pair', kicker: 'weak', description: 'Middle pair' };
            }

            return { level: 1, type: 'bottom_pair', kicker: 'weak', description: 'Bottom pair' };
        }
    }

    // Check for pocket pair (no board pair)
    if (heroRanks[0] === heroRanks[1]) {
        const ppRank = heroRanks[0];
        const highBoardCard = Math.max(...boardRanks);

        if (ppRank > highBoardCard) {
            return { level: 3, type: 'overpair', kicker: 'strong', description: 'Overpair' };
        }
        return { level: 1, type: 'underpair', kicker: 'weak', description: 'Underpair/pocket pair below board' };
    }

    // No pair - high card
    const highHeroCard = Math.max(...heroRanks);
    if (highHeroCard >= 13) {
        return { level: 0, type: 'high_card', kicker: 'strong', description: 'High card (A or K)' };
    }

    return { level: 0, type: 'air', kicker: 'none', description: 'No made hand' };
}

/**
 * Check if 5+ cards can make a straight
 */
function hasStraight(ranks: number[]): boolean {
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);

    // Add Ace as 1 for wheel detection
    if (uniqueRanks.includes(14)) {
        uniqueRanks.unshift(1);
    }

    let consecutive = 1;
    for (let i = 1; i < uniqueRanks.length; i++) {
        if (uniqueRanks[i] === uniqueRanks[i - 1] + 1) {
            consecutive++;
            if (consecutive >= 5) return true;
        } else {
            consecutive = 1;
        }
    }

    return false;
}

// =============================================================================
// DRAW EVALUATION
// =============================================================================

interface DrawResult {
    level: number;
    draws: string[];
    description: string;
}

/**
 * Evaluate draw strength (0-3)
 */
function evaluateDraws(heroCards: ParsedCard[], boardCards: ParsedCard[]): DrawResult {
    const draws: string[] = [];
    const allCards = [...heroCards, ...boardCards];
    const heroRanks = heroCards.map(c => c.rankValue);
    const heroSuits = heroCards.map(c => c.suit);
    const boardRanks = boardCards.map(c => c.rankValue);
    const boardSuits = boardCards.map(c => c.suit);
    const allRanks = allCards.map(c => c.rankValue);

    // Check flush draw
    const suitCounts: Record<string, number> = {};
    for (const card of allCards) {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    for (const [suit, count] of Object.entries(suitCounts)) {
        if (count === 4) {
            // 4 cards of same suit - flush draw
            const heroHasSuit = heroSuits.includes(suit);
            if (heroHasSuit) {
                draws.push('flush_draw');
            }
        }
    }

    // Check straight draws
    const uniqueRanks = Array.from(new Set(allRanks)).sort((a, b) => a - b);

    // Add Ace as 1 for wheel
    if (uniqueRanks.includes(14)) {
        uniqueRanks.unshift(1);
    }

    // Check for OESD (open-ended straight draw)
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
        const window = uniqueRanks.slice(i, i + 4);
        if (window[3] - window[0] === 3) {
            // 4 consecutive cards - OESD
            const heroContributes = heroRanks.some(r => window.includes(r) || (r === 14 && window.includes(1)));
            if (heroContributes) {
                if (!draws.includes('oesd')) {
                    draws.push('oesd');
                }
            }
        }
    }

    // Check for gutshot
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
        const window = uniqueRanks.slice(i, i + 5);
        if (window.length >= 4) {
            // Check for 1-gap pattern
            let gaps = 0;
            for (let j = 1; j < window.length && j < 5; j++) {
                if (window[j] - window[j - 1] === 2) gaps++;
            }
            if (gaps === 1 && window[Math.min(4, window.length - 1)] - window[0] === 4) {
                const heroContributes = heroRanks.some(r => window.includes(r));
                if (heroContributes && !draws.includes('oesd')) {
                    if (!draws.includes('gutshot')) {
                        draws.push('gutshot');
                    }
                }
            }
        }
    }

    // Check backdoor flush (2 of same suit on flop, hero has 1-2)
    if (boardCards.length === 3) {
        for (const [suit, count] of Object.entries(suitCounts)) {
            const heroSuitCount = heroSuits.filter(s => s === suit).length;
            if (count === 3 && heroSuitCount >= 1) {
                if (!draws.includes('flush_draw')) {
                    draws.push('backdoor_flush');
                }
            }
        }
    }

    // Calculate draw level
    let level = 0;
    let description = 'No draw';

    if (draws.length === 0) {
        level = 0;
        description = 'No draw';
    } else if (draws.includes('flush_draw') && (draws.includes('oesd') || draws.includes('gutshot'))) {
        level = 3;
        description = 'Combo draw (flush + straight)';
    } else if (draws.includes('flush_draw') || draws.includes('oesd')) {
        level = 2;
        description = draws.includes('flush_draw') ? 'Flush draw' : 'Open-ended straight draw';
    } else if (draws.includes('gutshot') || draws.includes('backdoor_flush')) {
        level = 1;
        description = draws.includes('gutshot') ? 'Gutshot straight draw' : 'Backdoor flush draw';
    }

    return { level, draws, description };
}

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

/**
 * Classify hero's hand on the board into 2D bucket
 */
export function classifyHand(heroHand: string, board: string): HandClassification {
    const heroCards = parseCards(heroHand);
    const boardCards = parseCards(board);

    // Need at least 2 hero cards and 3 board cards for postflop
    if (heroCards.length < 2 || boardCards.length < 3) {
        return {
            madeHand: 0,
            drawStrength: 0,
            bucket2D: '(0,0)',
            description: 'Unable to classify (insufficient cards)',
            details: {
                madeHandType: 'unknown',
                draws: [],
                kicker: 'none'
            }
        };
    }

    const madeResult = evaluateMadeHand(heroCards, boardCards);
    const drawResult = evaluateDraws(heroCards, boardCards);

    // Adjust draw level if we already have strong made hand
    let adjustedDrawLevel = drawResult.level;
    if (madeResult.level >= 4) {
        // Strong made hand - draws less important
        adjustedDrawLevel = Math.min(adjustedDrawLevel, 1);
    }

    // Boost if has pair + draw (combo hands)
    if (madeResult.level >= 1 && madeResult.level <= 2 && drawResult.level >= 2) {
        adjustedDrawLevel = 3; // Combo draw territory
    }

    const bucket2D = `(${madeResult.level},${adjustedDrawLevel})`;

    let description = madeResult.description;
    if (drawResult.draws.length > 0) {
        description += ` + ${drawResult.description}`;
    }

    return {
        madeHand: madeResult.level,
        drawStrength: adjustedDrawLevel,
        bucket2D,
        description,
        details: {
            madeHandType: madeResult.type,
            draws: drawResult.draws,
            kicker: madeResult.kicker
        }
    };
}

/**
 * Get strategic guidance based on 2D bucket
 */
export function getBucketStrategy(classification: HandClassification): string {
    const { madeHand, drawStrength } = classification;

    // Strong made hands (4-5)
    if (madeHand >= 4) {
        return 'VALUE: Strong made hand - bet for value, protect against draws';
    }

    // Good made + good draw (3, 2+)
    if (madeHand === 3 && drawStrength >= 2) {
        return 'AGGRESSIVE: Strong pair + draw - can bet/raise, has backup equity';
    }

    // Good made, no draw (3, 0-1)
    if (madeHand === 3) {
        return 'VALUE/PROTECT: Strong pair - bet for value and protection, be cautious of heavy action';
    }

    // Medium made + draw (2, 2+)
    if (madeHand === 2 && drawStrength >= 2) {
        return 'SEMI-BLUFF: Medium pair + draw - can bet/raise as semi-bluff';
    }

    // Medium made, no draw (2, 0-1)
    if (madeHand === 2) {
        return 'POT CONTROL: Medium pair - check/call often, avoid big pots';
    }

    // Weak made + draw (1, 2+)
    if (madeHand === 1 && drawStrength >= 2) {
        return 'SEMI-BLUFF: Weak pair + strong draw - can lead as semi-bluff';
    }

    // Weak made, no draw (1, 0-1)
    if (madeHand === 1) {
        return 'CHECK/FOLD: Weak pair - check and evaluate, often fold to aggression';
    }

    // No made + strong draw (0, 2-3)
    if (madeHand === 0 && drawStrength >= 2) {
        return 'SEMI-BLUFF: Strong draw - can bet/raise as semi-bluff';
    }

    // No made + weak draw (0, 1)
    if (madeHand === 0 && drawStrength === 1) {
        return 'FOLD/CHECK: Weak draw only - mostly check/fold unless getting good odds';
    }

    // Air (0, 0)
    return 'BLUFF/FOLD: No made hand, no draw - bluff or give up';
}
