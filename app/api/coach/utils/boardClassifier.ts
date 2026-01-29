/**
 * Board Texture Classifier
 * 
 * Code-based board classification to replace LLM-based analysis in Agent 0.
 * Provides accurate board texture and range advantage calculation.
 * 
 * Board Types:
 * - high_dry, high_2tone, high_monotone
 * - mid_dry, mid_2tone, mid_monotone
 * - low_dry, low_2tone, low_monotone
 * - paired, paired_2tone, paired_monotone
 * - connected, connected_2tone
 * - dynamic (multiple features)
 */

import { BoardAnalysis } from '../types/agentContracts';

// =============================================================================
// TYPES
// =============================================================================

export interface BoardClassification {
    type: string;
    suitPattern: 'rainbow' | 'two_tone' | 'monotone';
    highCard: string;
    isPaired: boolean;
    isConnected: boolean;
    flushPossible: boolean;
    straightPossible: boolean;
    description: string;
}

export interface RangeAdvantage {
    leader: 'hero' | 'villain' | 'even';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

export interface CodeClassificationResult {
    found: boolean;
    classification: BoardClassification;
    rangeAdvantage?: RangeAdvantage;
}

// =============================================================================
// CARD PARSING
// =============================================================================

interface ParsedCard {
    rank: string;
    suit: string;
    rankValue: number;
}

const RANK_VALUES: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_NAMES: Record<string, string> = {
    'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack', 'T': 'Ten',
    '9': 'Nine', '8': 'Eight', '7': 'Seven', '6': 'Six', '5': 'Five',
    '4': 'Four', '3': 'Three', '2': 'Two'
};

/**
 * Parse a single card string like "Ah" or "A♥" into rank and suit
 */
function parseCard(cardStr: string): ParsedCard | null {
    const cleaned = cardStr.trim().toUpperCase();

    if (cleaned.length < 2) return null;

    // Handle formats: "AH", "Ah", "A♥"
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

/**
 * Parse board string into array of cards
 * Handles: "Ah 7d 2c", "A♥ 7♦ 2♣", "Ah7d2c"
 */
export function parseBoard(board: string): ParsedCard[] {
    const cards: ParsedCard[] = [];

    // Try splitting by spaces first
    const parts = board.trim().split(/\s+/);

    if (parts.length >= 3) {
        // Space-separated format
        for (const part of parts) {
            const card = parseCard(part);
            if (card) cards.push(card);
        }
    } else {
        // No spaces - try parsing pairs of characters
        const cleaned = board.replace(/\s/g, '');
        for (let i = 0; i < cleaned.length - 1; i += 2) {
            const card = parseCard(cleaned.substring(i, i + 2));
            if (card) cards.push(card);
        }
    }

    return cards;
}

// =============================================================================
// BOARD ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Check if board is paired (has two cards of same rank)
 */
function isPaired(cards: ParsedCard[]): boolean {
    const ranks = cards.map(c => c.rank);
    return new Set(ranks).size < ranks.length;
}

/**
 * Determine suit pattern: rainbow, two_tone, or monotone
 */
function getSuitPattern(cards: ParsedCard[]): 'rainbow' | 'two_tone' | 'monotone' {
    const suits = cards.map(c => c.suit);
    const suitCounts: Record<string, number> = {};

    for (const suit of suits) {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    }

    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const uniqueSuits = Object.keys(suitCounts).length;

    if (maxSuitCount >= 3) return 'monotone';
    if (uniqueSuits === 3) return 'rainbow';  // Flop with 3 different suits
    if (maxSuitCount === 2) return 'two_tone';

    return 'rainbow';
}

/**
 * Get the high card of the board
 */
function getHighCard(cards: ParsedCard[]): string {
    const maxValue = Math.max(...cards.map(c => c.rankValue));
    const highCard = cards.find(c => c.rankValue === maxValue);
    return highCard?.rank || 'A';
}

/**
 * Check if board is connected (straight draws possible)
 */
function isConnected(cards: ParsedCard[]): boolean {
    const values = cards.map(c => c.rankValue).sort((a, b) => a - b);
    const uniqueValues = [...new Set(values)];

    if (uniqueValues.length < 3) return false;

    // Check for straight draw potential (3 cards within 4 ranks)
    const spread = uniqueValues[uniqueValues.length - 1] - uniqueValues[0];

    // Also check for wheel (A-2-3-4-5)
    const hasAce = uniqueValues.includes(14);
    const hasLow = uniqueValues.some(v => v <= 5);

    if (hasAce && hasLow) {
        // Check wheel connectivity
        const wheelValues = uniqueValues.map(v => v === 14 ? 1 : v).sort((a, b) => a - b);
        const wheelSpread = wheelValues[wheelValues.length - 1] - wheelValues[0];
        if (wheelSpread <= 4) return true;
    }

    return spread <= 4;
}

/**
 * Check if flush is possible (3+ same suit)
 */
function isFlushPossible(cards: ParsedCard[]): boolean {
    const suitCounts: Record<string, number> = {};
    for (const card of cards) {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    return Math.max(...Object.values(suitCounts)) >= 3;
}

/**
 * Check if straight is possible
 */
function isStraightPossible(cards: ParsedCard[]): boolean {
    return isConnected(cards);
}

// =============================================================================
// BOARD CLASSIFICATION
// =============================================================================

/**
 * Classify board texture into a category
 */
export function classifyBoard(board: string): BoardClassification {
    const cards = parseBoard(board);

    if (cards.length < 3) {
        return {
            type: 'unknown',
            suitPattern: 'rainbow',
            highCard: '',
            isPaired: false,
            isConnected: false,
            flushPossible: false,
            straightPossible: false,
            description: 'Unable to parse board'
        };
    }

    const paired = isPaired(cards);
    const suitPattern = getSuitPattern(cards);
    const highCard = getHighCard(cards);
    const connected = isConnected(cards);
    const flushPoss = isFlushPossible(cards);
    const straightPoss = isStraightPossible(cards);

    // Determine high card category
    const highValue = RANK_VALUES[highCard] || 0;
    let heightCategory: 'high' | 'mid' | 'low';
    if (highValue >= 13) {
        heightCategory = 'high';  // A or K
    } else if (highValue >= 11) {
        heightCategory = 'mid';   // Q or J
    } else {
        heightCategory = 'low';   // T or lower
    }

    // Count features to detect dynamic boards
    const featureCount = [paired, connected, suitPattern === 'monotone'].filter(Boolean).length;

    let type: string;
    let description: string;

    if (featureCount >= 2) {
        // Multiple features = dynamic
        type = 'dynamic';
        description = `Dynamic board - multiple features (${paired ? 'paired, ' : ''}${connected ? 'connected, ' : ''}${suitPattern})`;
    } else if (paired) {
        type = suitPattern === 'rainbow' ? 'paired' : `paired_${suitPattern}`;
        description = `Paired ${highCard}-high board, ${suitPattern}`;
    } else if (connected) {
        type = suitPattern === 'rainbow' ? 'connected' : `connected_${suitPattern}`;
        description = `Connected ${highCard}-high board, ${suitPattern}`;
    } else if (suitPattern === 'monotone') {
        type = `${heightCategory}_monotone`;
        description = `${RANK_NAMES[highCard]}-high monotone (flush possible)`;
    } else if (suitPattern === 'two_tone') {
        type = `${heightCategory}_2tone`;
        description = `${RANK_NAMES[highCard]}-high two-tone (flush draw possible)`;
    } else {
        type = `${heightCategory}_dry`;
        description = `${RANK_NAMES[highCard]}-high rainbow, dry board`;
    }

    return {
        type,
        suitPattern,
        highCard,
        isPaired: paired,
        isConnected: connected,
        flushPossible: flushPoss,
        straightPossible: straightPoss,
        description
    };
}

// =============================================================================
// RANGE ADVANTAGE CALCULATION
// =============================================================================

/**
 * Determine range advantage based on board texture and positions
 */
export function determineRangeAdvantage(
    classification: BoardClassification,
    heroPosition: string,
    villainPosition: string,
    potType: 'srp' | '3bet' | '4bet' = 'srp'
): RangeAdvantage {
    const { type, highCard, isPaired, isConnected, suitPattern } = classification;
    const heroPos = heroPosition.toUpperCase();
    const villainPos = villainPosition.toUpperCase();

    // Determine who is the preflop aggressor vs defender
    const ipPositions = ['BTN', 'CO', 'HJ', 'MP'];
    const heroIsIP = ipPositions.some(p => heroPos.includes(p));
    const heroIsBB = heroPos === 'BB';
    const heroIsSB = heroPos === 'SB';

    // High card boards favor raisers (more broadway in opening range)
    if (type.includes('high') && !isPaired) {
        if (heroIsIP) {
            return {
                leader: 'hero',
                confidence: 'high',
                reason: `${highCard}-high board favors raiser's range (more broadways)`
            };
        } else if (heroIsBB) {
            return {
                leader: 'villain',
                confidence: 'high',
                reason: `${highCard}-high board favors opener's range (more Ax, Kx)`
            };
        }
    }

    // Low connected boards favor BB (more suited connectors in defense range)
    if (type.includes('low') && isConnected) {
        if (heroIsBB) {
            return {
                leader: 'hero',
                confidence: 'medium',
                reason: 'Low connected board favors BB defense range (more suited connectors)'
            };
        } else {
            return {
                leader: 'villain',
                confidence: 'medium',
                reason: 'Low connected board favors defender (more small pairs, suited connectors)'
            };
        }
    }

    // Paired boards are more neutral
    if (isPaired) {
        return {
            leader: 'even',
            confidence: 'low',
            reason: 'Paired board - neither player has significant advantage'
        };
    }

    // Monotone boards reduce range advantages (draws equalize)
    if (suitPattern === 'monotone') {
        return {
            leader: 'even',
            confidence: 'medium',
            reason: 'Monotone board - flush draws reduce positional advantage'
        };
    }

    // 3bet pots favor 3bettor
    if (potType === '3bet') {
        return {
            leader: heroIsBB || heroIsSB ? 'hero' : 'villain',
            confidence: 'high',
            reason: '3bet pot - 3bettor has more overpairs and premium hands'
        };
    }

    // Default: IP has slight advantage on dry boards
    if (heroIsIP) {
        return {
            leader: 'hero',
            confidence: 'low',
            reason: 'Position advantage on relatively neutral board'
        };
    }

    return {
        leader: 'even',
        confidence: 'low',
        reason: 'No clear range advantage on this texture'
    };
}

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

/**
 * Full board classification with range advantage
 */
export function classifyBoardComplete(
    board: string,
    heroPosition?: string,
    villainPosition?: string,
    potType: 'srp' | '3bet' | '4bet' = 'srp'
): CodeClassificationResult {
    const classification = classifyBoard(board);

    if (classification.type === 'unknown') {
        return {
            found: false,
            classification
        };
    }

    const rangeAdvantage = heroPosition && villainPosition
        ? determineRangeAdvantage(classification, heroPosition, villainPosition, potType)
        : undefined;

    return {
        found: true,
        classification,
        rangeAdvantage
    };
}

// =============================================================================
// CONVERT TO BOARD ANALYSIS (For Agent 0 compatibility)
// =============================================================================

/**
 * Get C-Bet frequency recommendation based on board texture
 * Based on GTO solver outputs for 6-max cash games
 */
function getCBetRecommendation(classification: BoardClassification): {
    ip_frequency: number;
    oop_frequency: number;
    reasoning: string;
} {
    const { type, isPaired, isConnected, suitPattern, highCard } = classification;

    // Dry high boards: High c-bet frequency (range advantage)
    if (type.includes('high') && type.includes('dry')) {
        return {
            ip_frequency: 0.75,
            oop_frequency: 0.35,
            reasoning: `${highCard}-high dry board heavily favors raiser's range`
        };
    }

    // Paired boards: Moderate frequency (depends on high card)
    if (isPaired) {
        const highValue = RANK_VALUES[highCard] || 0;
        if (highValue >= 11) { // J+ paired
            return {
                ip_frequency: 0.65,
                oop_frequency: 0.30,
                reasoning: `High paired board - raiser has nut advantage`
            };
        } else {
            return {
                ip_frequency: 0.45,
                oop_frequency: 0.20,
                reasoning: `Low paired board - caller has more trips combos`
            };
        }
    }

    // Connected/wet boards: Lower c-bet frequency
    if (isConnected || type.includes('connected')) {
        if (suitPattern === 'monotone') {
            return {
                ip_frequency: 0.35,
                oop_frequency: 0.15,
                reasoning: `Monotone connected board - check back often, protect when betting`
            };
        }
        return {
            ip_frequency: 0.45,
            oop_frequency: 0.25,
            reasoning: `Connected board - selective c-betting, range protection important`
        };
    }

    // Two-tone boards: Moderate frequency
    if (suitPattern === 'two_tone') {
        return {
            ip_frequency: 0.55,
            oop_frequency: 0.28,
            reasoning: `Two-tone texture - bet draws for equity denial, check marginal`
        };
    }

    // Monotone boards: Very low frequency
    if (suitPattern === 'monotone') {
        return {
            ip_frequency: 0.40,
            oop_frequency: 0.18,
            reasoning: `Monotone board - flush draws equalize ranges, bet selectively`
        };
    }

    // Default dry mid/low boards
    return {
        ip_frequency: 0.60,
        oop_frequency: 0.30,
        reasoning: `Standard texture - balanced c-betting strategy`
    };
}

/**
 * Get bet sizing recommendation based on board texture
 */
function getSizingRecommendation(classification: BoardClassification): {
    flop: string;
    turn?: string;
    reasoning: string;
} {
    const { type, isConnected, suitPattern, isPaired } = classification;

    // Dry boards: Small sizing (don't need much to deny equity)
    if (type.includes('dry') || (suitPattern === 'rainbow' && !isConnected && !isPaired)) {
        return {
            flop: 'small (25-33%)',
            turn: 'medium (50-66%)',
            reasoning: 'Dry board - small flop sizing, larger turn barrels for value'
        };
    }

    // Wet/dynamic boards: Larger sizing (deny equity to draws)
    if (isConnected || type === 'dynamic' || suitPattern === 'monotone') {
        return {
            flop: 'large (66-75%)',
            turn: 'large (66-80%)',
            reasoning: 'Wet board - larger sizing to deny equity to draws'
        };
    }

    // Two-tone: Medium sizing
    if (suitPattern === 'two_tone') {
        return {
            flop: 'medium (50%)',
            turn: 'medium-large (60-70%)',
            reasoning: 'Two-tone - balanced sizing, threaten draws'
        };
    }

    // Paired boards: Polarized or small
    if (isPaired) {
        return {
            flop: 'small (33%) or overbet',
            turn: 'medium (50-66%)',
            reasoning: 'Paired board - small for thin value, overbet with trips+'
        };
    }

    // Default
    return {
        flop: 'medium (50%)',
        turn: 'medium (50-66%)',
        reasoning: 'Standard sizing for this texture'
    };
}

/**
 * Get texture advantage (who does this board favor)
 */
function getTextureAdvantage(classification: BoardClassification): {
    favors: 'raiser' | 'caller' | 'neutral';
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
} {
    const { highCard, isPaired, isConnected, suitPattern } = classification;
    const highValue = RANK_VALUES[highCard] || 0;

    // High card boards (A/K) strongly favor raiser
    if (highValue === 14) { // Ace high
        return {
            favors: 'raiser',
            confidence: 'high',
            reasoning: 'Ace-high board - raiser has many more Ax combos'
        };
    }

    if (highValue === 13) { // King high
        return {
            favors: 'raiser',
            confidence: 'high',
            reasoning: 'King-high board - raiser range connects better'
        };
    }

    // Low paired boards favor caller
    if (isPaired && highValue <= 9) {
        return {
            favors: 'caller',
            confidence: 'medium',
            reasoning: 'Low paired board - caller has more trips combos'
        };
    }

    // Low connected boards favor caller
    if (isConnected && highValue <= 9) {
        return {
            favors: 'caller',
            confidence: 'medium',
            reasoning: 'Low connected board - caller has more suited connectors'
        };
    }

    // Monotone slightly equalizes
    if (suitPattern === 'monotone') {
        return {
            favors: 'neutral',
            confidence: 'medium',
            reasoning: 'Monotone board - flush draws equalize ranges'
        };
    }

    // Mid boards are more neutral
    if (highValue >= 10 && highValue <= 12) {
        return {
            favors: 'raiser',
            confidence: 'low',
            reasoning: 'Mid-high board - slight raiser advantage'
        };
    }

    return {
        favors: 'neutral',
        confidence: 'low',
        reasoning: 'Board texture is relatively neutral'
    };
}

/**
 * Analyze turn card for GTO context
 */
function analyzeTurnCard(
    turnCard: ParsedCard,
    flopCards: ParsedCard[],
    classification: BoardClassification
): {
    impact: string;
    range_shift: string;
    completes_draws: string[];
    is_scare_card: boolean;
    barrel_recommendation: string;
} {
    const completes: string[] = [];
    let isScare = false;
    let rangeShift = 'neutral';

    // Check if turn completes flush
    const suits = [...flopCards.map(c => c.suit), turnCard.suit];
    const suitCounts: Record<string, number> = {};
    for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
    const maxSuit = Math.max(...Object.values(suitCounts));

    if (maxSuit >= 4) {
        completes.push('flush');
        isScare = true;
    } else if (maxSuit === 3 && classification.suitPattern !== 'monotone') {
        // Flush draw came in (3 to suit on turn)
        completes.push('third flush card');
    }

    // Check for straight completion (simplified)
    const allValues = [...flopCards.map(c => c.rankValue), turnCard.rankValue].sort((a, b) => a - b);
    const uniqueValues = [...new Set(allValues)];
    if (uniqueValues.length >= 4) {
        const spread = uniqueValues[uniqueValues.length - 1] - uniqueValues[0];
        if (spread === 3) {
            completes.push('possible straight');
            isScare = true;
        }
    }

    // Check for overcard
    const flopHigh = Math.max(...flopCards.map(c => c.rankValue));
    if (turnCard.rankValue > flopHigh) {
        isScare = true;
        if (turnCard.rankValue >= 13) { // A or K
            rangeShift = 'favors raiser';
        }
    }

    // Check for blank
    const isBlank = !isScare && turnCard.rankValue < flopHigh && completes.length === 0;

    // Build impact description
    let impact = `${RANK_NAMES[turnCard.rank] || turnCard.rank}`;
    if (completes.length > 0) {
        impact += ` - completes ${completes.join(', ')}`;
    } else if (isBlank) {
        impact += ' - blank (no draws complete)';
    } else if (turnCard.rankValue > flopHigh) {
        impact += ' - overcard';
    }

    // Barrel recommendation
    let barrelRec = 'check back marginal hands';
    if (isBlank) {
        barrelRec = 'continue betting value hands';
    } else if (isScare) {
        barrelRec = 'proceed cautiously, check marginal hands';
    }

    return {
        impact,
        range_shift: rangeShift,
        completes_draws: completes,
        is_scare_card: isScare,
        barrel_recommendation: barrelRec
    };
}

/**
 * Analyze river card for GTO context
 */
function analyzeRiverCard(
    riverCard: ParsedCard,
    allPreviousCards: ParsedCard[],
    classification: BoardClassification
): {
    impact: string;
    completes_draws: string[];
    is_scare_card: boolean;
    is_blank: boolean;
} {
    const completes: string[] = [];
    let isScare = false;

    // Check if river completes flush
    const suits = [...allPreviousCards.map(c => c.suit), riverCard.suit];
    const suitCounts: Record<string, number> = {};
    for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
    const maxSuit = Math.max(...Object.values(suitCounts));

    if (maxSuit >= 4) {
        completes.push('flush');
        isScare = true;
    }

    // Check for 4-straight on board
    const allValues = [...allPreviousCards.map(c => c.rankValue), riverCard.rankValue].sort((a, b) => a - b);
    const uniqueValues = [...new Set(allValues)];
    if (uniqueValues.length >= 4) {
        // Check for 4 connected cards
        for (let i = 0; i <= uniqueValues.length - 4; i++) {
            if (uniqueValues[i + 3] - uniqueValues[i] <= 4) {
                completes.push('possible straight');
                isScare = true;
                break;
            }
        }
    }

    // Check for overcard
    const previousHigh = Math.max(...allPreviousCards.map(c => c.rankValue));
    if (riverCard.rankValue > previousHigh && riverCard.rankValue >= 13) {
        isScare = true;
    }

    // Blank check
    const isBlank = !isScare && completes.length === 0 && riverCard.rankValue <= previousHigh;

    // Build impact
    let impact = `${RANK_NAMES[riverCard.rank] || riverCard.rank}`;
    if (completes.length > 0) {
        impact += ` - completes ${completes.join(', ')}`;
    } else if (isBlank) {
        impact += ' - blank';
    } else if (riverCard.rankValue > previousHigh) {
        impact += ' - overcard';
    }

    return {
        impact,
        completes_draws: completes,
        is_scare_card: isScare,
        is_blank: isBlank
    };
}

/**
 * Convert code classification to BoardAnalysis format for Agent 0
 */
export function toBoardAnalysis(
    board: string,
    classification: BoardClassification
): BoardAnalysis {
    const cards = parseBoard(board);
    const flopCards = cards.slice(0, 3);
    const turnCard = cards[3];
    const riverCard = cards[4];

    const flopStr = flopCards.map(c => `${c.rank}${c.suit}`).join(' ');

    // Build draws possible list
    const drawsPossible: string[] = [];
    if (classification.flushPossible) {
        drawsPossible.push('flush');
    }
    if (classification.straightPossible) {
        drawsPossible.push('straight');
    }
    if (classification.suitPattern === 'two_tone') {
        drawsPossible.push('flush draw');
    }
    if (classification.isConnected && !classification.straightPossible) {
        drawsPossible.push('gutshot');
    }

    // Get GTO recommendations
    const cbetRec = getCBetRecommendation(classification);
    const sizingRec = getSizingRecommendation(classification);
    const textureAdv = getTextureAdvantage(classification);

    const result: BoardAnalysis = {
        flop: {
            cards: flopStr,
            texture: classification.description,
            draws_possible: drawsPossible,
            scary_for: classification.highCard === 'A' || classification.highCard === 'K'
                ? 'weak pairs, small pairs'
                : 'overpairs, big cards'
        },
        summary: {
            is_paired: classification.isPaired,
            flush_possible: classification.flushPossible,
            straight_possible: classification.straightPossible,
            high_cards: [classification.highCard]
        },
        // NEW: GTO context
        cbet_recommendation: cbetRec,
        sizing_recommendation: sizingRec,
        texture_advantage: textureAdv
    };

    if (turnCard) {
        const turnAnalysis = analyzeTurnCard(turnCard, flopCards, classification);
        result.turn = {
            card: `${turnCard.rank}${turnCard.suit}`,
            impact: turnAnalysis.impact,
            range_shift: turnAnalysis.range_shift,
            completes_draws: turnAnalysis.completes_draws,
            is_scare_card: turnAnalysis.is_scare_card,
            barrel_recommendation: turnAnalysis.barrel_recommendation
        };
    }

    if (riverCard) {
        const riverAnalysis = analyzeRiverCard(riverCard, [...flopCards, turnCard!], classification);
        result.river = {
            card: `${riverCard.rank}${riverCard.suit}`,
            impact: riverAnalysis.impact,
            completes_draws: riverAnalysis.completes_draws,
            is_scare_card: riverAnalysis.is_scare_card,
            is_blank: riverAnalysis.is_blank
        };
    }

    return result;
}

