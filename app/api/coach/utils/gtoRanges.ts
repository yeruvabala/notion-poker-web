/**
 * GTO Preflop Ranges for 6-Max Cash Games
 * 
 * Source: Based on GTO Wizard / hhana project solver outputs
 * 
 * This file provides range-based preflop decision making to eliminate
 * LLM hallucinations for basic poker decisions.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface RangeAction {
    action: 'raise' | 'call' | 'fold' | '3bet' | '4bet' | '5bet';
    frequency: number;  // 0.0 to 1.0
    sizing?: string;    // e.g., "2.5bb", "11bb"
}

export type Position = 'UTG' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface RangeResult {
    found: boolean;
    action: RangeAction;
    scenario: string;
    source: 'range_table' | 'llm_fallback';
}

// =============================================================================
// HAND NORMALIZATION
// =============================================================================

/**
 * Normalize a hand like "As Kh" or "AsKh" to canonical form "AKo" or "AKs"
 */
export function normalizeHand(hand: string): string {
    // Clean the input - remove spaces and standardize
    const cleaned = hand.replace(/\s+/g, '').toUpperCase();

    // Handle formats like "7♠ 2♥" or "7s2h" or "7s 2h"
    const cardPattern = /([2-9TJQKA])([♠♥♦♣SHDC])/gi;
    const matches = [...cleaned.matchAll(cardPattern)];

    if (matches.length < 2) {
        // Try simpler format like "AK" or "72"
        if (cleaned.length === 2) {
            return cleaned; // Already normalized pair
        }
        return cleaned.slice(0, 2).toUpperCase(); // Best effort
    }

    const rank1 = matches[0][1].toUpperCase();
    const suit1 = matches[0][2].toUpperCase();
    const rank2 = matches[1][1].toUpperCase();
    const suit2 = matches[1][2].toUpperCase();

    // Normalize suits to single letter
    const normSuit1 = normalizeSuit(suit1);
    const normSuit2 = normalizeSuit(suit2);

    // Get rank values for ordering
    const rankOrder = '23456789TJQKA';
    const val1 = rankOrder.indexOf(rank1);
    const val2 = rankOrder.indexOf(rank2);

    // Pairs
    if (rank1 === rank2) {
        return `${rank1}${rank2}`;
    }

    // Order high card first
    const [high, low] = val1 > val2 ? [rank1, rank2] : [rank2, rank1];
    const suited = normSuit1 === normSuit2;

    return `${high}${low}${suited ? 's' : 'o'}`;
}

function normalizeSuit(suit: string): string {
    const suitMap: Record<string, string> = {
        '♠': 's', 'S': 's',
        '♥': 'h', 'H': 'h',
        '♦': 'd', 'D': 'd',
        '♣': 'c', 'C': 'c',
    };
    return suitMap[suit] || suit.toLowerCase();
}

// =============================================================================
// POSITION NORMALIZATION (6-max, 7-max, 8-max, 9-max support)
// =============================================================================

/**
 * Map any position to a 6-max equivalent position for range lookup
 * 
 * Full Ring (9-max) → 6-max mapping:
 * - UTG, UTG+1, UTG+2, EP → UTG (tightest)
 * - LJ (Lojack) → HJ
 * - HJ (Hijack) → HJ
 * - MP → HJ
 * - CO → CO
 * - BTN → BTN
 * - SB → SB
 * - BB → BB
 */
export function normalizePosition(position: string): string {
    const posUpper = position.toUpperCase().replace(/\s+/g, '');

    // Direct mappings
    const positionMap: Record<string, string> = {
        // Late positions (keep as is)
        'BTN': 'BTN',
        'BU': 'BTN',
        'BUTTON': 'BTN',
        'D': 'BTN',
        'DEALER': 'BTN',
        'CO': 'CO',
        'CUTOFF': 'CO',

        // Middle positions → HJ
        'HJ': 'HJ',
        'HIJACK': 'HJ',
        'MP': 'HJ',
        'MP1': 'HJ',
        'MP2': 'HJ',
        'LJ': 'HJ',
        'LOJACK': 'HJ',

        // Early positions → UTG (tightest range)
        'UTG': 'UTG',
        'EP': 'UTG',
        'EARLYPOSITION': 'UTG',
        'UTG+1': 'UTG',
        'UTG1': 'UTG',
        'UTG+2': 'UTG',
        'UTG2': 'UTG',
        'UTG+3': 'UTG',
        'UTG3': 'UTG',
        'EP1': 'UTG',
        'EP2': 'UTG',
        'EP3': 'UTG',

        // Blinds
        'SB': 'SB',
        'SMALLBLIND': 'SB',
        'BB': 'BB',
        'BIGBLIND': 'BB',
    };

    return positionMap[posUpper] || posUpper;
}

// =============================================================================
// RFI (RAISE FIRST IN) RANGES - 6-MAX 100BB
// =============================================================================
// Frequency: 1.0 = always, 0.5 = 50% of time, 0 = never

const RFI_RANGES: Record<string, Record<string, number>> = {
    // Button (BTN) - ~45% of hands
    BTN: {
        // Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 1.0, '33': 1.0, '22': 1.0,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 0.8,
        'K7s': 0.6, 'K6s': 0.6, 'K5s': 0.5, 'K4s': 0.4, 'K3s': 0.3, 'K2s': 0.2,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 0.7, 'Q7s': 0.4,
        'Q6s': 0.3, 'Q5s': 0.2, 'Q4s': 0.1,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 0.7, 'J7s': 0.4,
        // Suited Tens
        'T9s': 1.0, 'T8s': 0.9, 'T7s': 0.4,
        // Suited Connectors
        '98s': 1.0, '97s': 0.6, '87s': 1.0, '86s': 0.5,
        '76s': 1.0, '75s': 0.3, '65s': 1.0, '64s': 0.2,
        '54s': 1.0, '53s': 0.2, '43s': 0.3,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 0.8,
        'A8o': 0.6, 'A7o': 0.5, 'A6o': 0.4, 'A5o': 0.5, 'A4o': 0.4,
        'A3o': 0.3, 'A2o': 0.2,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 0.8, 'K9o': 0.5,
        // Offsuit Queens
        'QJo': 1.0, 'QTo': 0.7,
        // Offsuit Jacks
        'JTo': 0.8,
    },

    // Cutoff (CO) - ~30% of hands
    CO: {
        // Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 0.8, '33': 0.6, '22': 0.5,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 0.9, 'A7s': 0.8, 'A6s': 0.7, 'A5s': 1.0, 'A4s': 0.9,
        'A3s': 0.8, 'A2s': 0.7,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.9, 'K8s': 0.5,
        'K7s': 0.3, 'K6s': 0.3, 'K5s': 0.2,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.8, 'Q8s': 0.4,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 0.9, 'J8s': 0.4,
        // Suited Tens
        'T9s': 1.0, 'T8s': 0.7,
        // Suited Connectors
        '98s': 1.0, '97s': 0.4, '87s': 1.0, '76s': 1.0,
        '65s': 0.9, '54s': 0.8,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 0.9, 'A9o': 0.5,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 0.9, 'KTo': 0.5,
        // Offsuit Queens
        'QJo': 0.8, 'QTo': 0.4,
        // Offsuit Jacks
        'JTo': 0.5,
    },

    // Hijack (HJ) / MP - ~23% of hands
    HJ: {
        // Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 0.9, '55': 0.7,
        '44': 0.5, '33': 0.3, '22': 0.2,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.9,
        'A8s': 0.7, 'A7s': 0.6, 'A6s': 0.5, 'A5s': 0.9, 'A4s': 0.7,
        'A3s': 0.5, 'A2s': 0.4,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.7, 'K8s': 0.3,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.5,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 0.7,
        // Suited Tens
        'T9s': 1.0, 'T8s': 0.5,
        // Suited Connectors
        '98s': 0.9, '87s': 0.8, '76s': 0.7, '65s': 0.5, '54s': 0.4,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 0.7,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 0.7,
        // Offsuit Queens
        'QJo': 0.5,
    },

    // MP (Middle Position) - alias for HJ in 6-max
    MP: {}, // Will copy from HJ

    // Under The Gun (UTG) - ~18% of hands
    UTG: {
        // Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 0.9, '77': 0.8, '66': 0.6, '55': 0.4,
        '44': 0.2, '33': 0.1, '22': 0.1,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.7,
        'A8s': 0.5, 'A7s': 0.4, 'A6s': 0.3, 'A5s': 0.7, 'A4s': 0.5,
        'A3s': 0.3, 'A2s': 0.2,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.9, 'K9s': 0.4,
        // Suited Queens
        'QJs': 1.0, 'QTs': 0.9, 'Q9s': 0.3,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 0.5,
        // Suited Tens
        'T9s': 0.9, 'T8s': 0.3,
        // Suited Connectors
        '98s': 0.7, '87s': 0.5, '76s': 0.4, '65s': 0.3,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 0.9, 'ATo': 0.5,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 0.5,
        // Offsuit Queens
        'QJo': 0.3,
    },

    // Small Blind (SB) vs BB - special case (raise to 3bb)
    SB: {
        // Very wide range vs BB only
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 1.0, '33': 1.0, '22': 1.0,
        // All suited aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        // All suited kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 1.0, 'K4s': 1.0, 'K3s': 1.0, 'K2s': 1.0,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 0.8,
        'Q6s': 0.7, 'Q5s': 0.6, 'Q4s': 0.5, 'Q3s': 0.4, 'Q2s': 0.3,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 0.8, 'J6s': 0.5,
        // Suited Connectors
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 0.8, '98s': 1.0, '97s': 0.9,
        '87s': 1.0, '86s': 0.8, '76s': 1.0, '75s': 0.7, '65s': 1.0,
        '64s': 0.6, '54s': 1.0, '53s': 0.5, '43s': 0.6, '32s': 0.3,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 1.0,
        'A8o': 0.9, 'A7o': 0.8, 'A6o': 0.7, 'A5o': 0.9, 'A4o': 0.8,
        'A3o': 0.7, 'A2o': 0.6,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 0.9, 'K8o': 0.7,
        'K7o': 0.5, 'K6o': 0.4, 'K5o': 0.3,
        // Offsuit Queens
        'QJo': 1.0, 'QTo': 1.0, 'Q9o': 0.8, 'Q8o': 0.5,
        // Offsuit Jacks
        'JTo': 1.0, 'J9o': 0.7,
        // Offsuit Tens
        'T9o': 0.8, 'T8o': 0.4,
        // Offsuit Connectors
        '98o': 0.6, '87o': 0.5, '76o': 0.4, '65o': 0.3, '54o': 0.3,
    },
};

// Copy HJ to MP
RFI_RANGES.MP = { ...RFI_RANGES.HJ };

// =============================================================================
// 3-BET RANGES (When facing an open raise)
// =============================================================================

const THREE_BET_RANGES: Record<string, Record<string, Record<string, number>>> = {
    // SB 3bet vs BTN open
    'SB_vs_BTN': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.9, 'TT': 0.5,
            'AKs': 1.0, 'AQs': 1.0, 'AJs': 0.8, 'ATs': 0.5,
            'A5s': 0.9, 'A4s': 0.7, 'A3s': 0.5, // Blocker 3bets
            'KQs': 0.7, 'KJs': 0.4,
            'AKo': 1.0, 'AQo': 0.8,
        },
        'call': {
            'JJ': 0.1, 'TT': 0.5, '99': 1.0, '88': 1.0, '77': 1.0,
            '66': 1.0, '55': 1.0, '44': 1.0, '33': 0.8, '22': 0.6,
            'AJs': 0.2, 'ATs': 0.5, 'A9s': 1.0, 'A8s': 1.0, 'A7s': 1.0,
            'A6s': 1.0, 'A5s': 0.1, 'A4s': 0.3, 'A3s': 0.5, 'A2s': 1.0,
            'KQs': 0.3, 'KJs': 0.6, 'KTs': 1.0, 'K9s': 1.0,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.8,
            'JTs': 1.0, 'J9s': 1.0, 'T9s': 1.0, 'T8s': 0.9,
            '98s': 1.0, '97s': 0.7, '87s': 1.0, '76s': 1.0, '65s': 0.9, '54s': 0.8,
            'AQo': 0.2, 'AJo': 0.5, 'ATo': 0.7,
            'KQo': 0.8, 'KJo': 0.6, 'QJo': 0.5,
        },
    },

    // BB 3bet vs BTN open
    'BB_vs_BTN': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7, 'TT': 0.3,
            'AKs': 1.0, 'AQs': 0.9, 'AJs': 0.6,
            'A5s': 0.8, 'A4s': 0.6,
            'KQs': 0.5,
            'AKo': 1.0, 'AQo': 0.7,
        },
        'call': {
            'JJ': 0.3, 'TT': 0.7, '99': 1.0, '88': 1.0, '77': 1.0,
            '66': 1.0, '55': 1.0, '44': 1.0, '33': 1.0, '22': 1.0,
            'AQs': 0.1, 'AJs': 0.4, 'ATs': 1.0, 'A9s': 1.0, 'A8s': 1.0,
            'A7s': 1.0, 'A6s': 1.0, 'A5s': 0.2, 'A4s': 0.4, 'A3s': 1.0, 'A2s': 1.0,
            'KQs': 0.5, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 0.8,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 0.7,
            'JTs': 1.0, 'J9s': 1.0, 'J8s': 0.8, 'T9s': 1.0, 'T8s': 1.0,
            '98s': 1.0, '97s': 0.9, '87s': 1.0, '86s': 0.8,
            '76s': 1.0, '75s': 0.6, '65s': 1.0, '54s': 1.0, '43s': 0.7,
            'AQo': 0.3, 'AJo': 0.8, 'ATo': 1.0, 'A9o': 0.8,
            'KQo': 0.8, 'KJo': 1.0, 'KTo': 0.9,
            'QJo': 1.0, 'QTo': 0.8, 'JTo': 1.0, 'T9o': 0.7,
        },
    },

    // BB 3bet vs CO open (tighter)
    'BB_vs_CO': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.5,
            'AKs': 1.0, 'AQs': 0.7, 'A5s': 0.6,
            'AKo': 1.0, 'AQo': 0.5,
        },
        'call': {
            'JJ': 0.5, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 1.0,
            '66': 1.0, '55': 1.0, '44': 0.8, '33': 0.6, '22': 0.5,
            'AQs': 0.3, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.9, 'A8s': 0.8,
            'A5s': 0.4, 'A4s': 1.0, 'A3s': 0.9, 'A2s': 0.8,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.8,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.7,
            'JTs': 1.0, 'J9s': 0.9, 'T9s': 1.0, 'T8s': 0.8,
            '98s': 1.0, '87s': 1.0, '76s': 0.9, '65s': 0.8, '54s': 0.7,
            'AQo': 0.5, 'AJo': 1.0, 'ATo': 0.8,
            'KQo': 1.0, 'KJo': 0.9, 'QJo': 0.8,
        },
    },

    // BB 3bet vs UTG open (very tight)
    'BB_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8, 'JJ': 0.3,
            'AKs': 1.0, 'AQs': 0.4,
            'AKo': 0.9,
        },
        'call': {
            'QQ': 0.2, 'JJ': 0.7, 'TT': 1.0, '99': 1.0, '88': 1.0,
            '77': 0.9, '66': 0.8, '55': 0.6, '44': 0.4, '33': 0.3, '22': 0.2,
            'AQs': 0.6, 'AJs': 0.9, 'ATs': 0.8, 'A5s': 0.7, 'A4s': 0.6,
            'KQs': 1.0, 'KJs': 0.8, 'KTs': 0.6,
            'QJs': 0.9, 'QTs': 0.7,
            'JTs': 0.9, 'T9s': 0.8, '98s': 0.7, '87s': 0.6, '76s': 0.5,
            'AKo': 0.1, 'AQo': 0.8, 'AJo': 0.6,
            'KQo': 0.8,
        },
    },
};

// =============================================================================
// VS 3-BET RANGES (When you open and face a 3bet)
// =============================================================================

const VS_THREE_BET_RANGES: Record<string, Record<string, Record<string, number>>> = {
    // BTN open, facing SB 3bet
    'BTN_vs_SB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.5, 'AKs': 0.6, 'AKo': 0.5,
        },
        'call': {
            'QQ': 0.5, 'JJ': 1.0, 'TT': 1.0, '99': 0.9, '88': 0.8,
            '77': 0.7, '66': 0.5, '55': 0.4, '44': 0.3, '33': 0.2, '22': 0.1,
            'AKs': 0.4, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.8,
            'A5s': 0.9, 'A4s': 1.0, 'A3s': 0.9,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.9,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.7,
            'JTs': 1.0, 'J9s': 0.9, 'T9s': 1.0, 'T8s': 0.9,
            '98s': 0.9, '87s': 0.9, '76s': 1.0, '65s': 0.9, '54s': 1.0,
            'AKo': 0.5, 'AQo': 0.7, 'AJo': 0.6,
            'KQo': 0.8, 'KJo': 0.3,
        },
    },

    // CO open, facing BB 3bet
    'CO_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.4, 'AKs': 0.5, 'AKo': 0.4,
        },
        'call': {
            'QQ': 0.6, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.6,
            '77': 0.4, '66': 0.3, '55': 0.2,
            'AKs': 0.5, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.9,
            'A5s': 0.8, 'A4s': 0.9,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.9,
            'QJs': 1.0, 'QTs': 0.9,
            'JTs': 1.0, 'T9s': 1.0, '98s': 0.8, '87s': 0.7, '76s': 0.8,
            'AKo': 0.6, 'AQo': 0.6,
            'KQo': 0.7,
        },
    },
};

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Get the opening action for a hand from a specific position
 */
export function getOpeningAction(hand: string, position: string): RangeResult {
    const normalized = normalizeHand(hand);
    const posKey = normalizePosition(position);

    const range = RFI_RANGES[posKey];
    if (!range) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: `RFI_${posKey}`,
            source: 'llm_fallback',
        };
    }

    const frequency = range[normalized];

    if (frequency !== undefined && frequency > 0) {
        // Determine action based on frequency
        // If frequency >= 0.5, recommend raise; otherwise mixed/fold
        const action: RangeAction = frequency >= 0.5
            ? { action: 'raise', frequency, sizing: posKey === 'SB' ? '3bb' : '2.5bb' }
            : { action: 'raise', frequency, sizing: posKey === 'SB' ? '3bb' : '2.5bb' };

        return {
            found: true,
            action,
            scenario: `RFI_${posKey}`,
            source: 'range_table',
        };
    }

    // Not in range = fold
    return {
        found: true,
        action: { action: 'fold', frequency: 1.0 },
        scenario: `RFI_${posKey}`,
        source: 'range_table',
    };
}

/**
 * Get action when facing an open raise (call/3bet/fold)
 */
export function getFacingOpenAction(
    hand: string,
    heroPosition: string,
    openerPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const key = `${heroPosition.toUpperCase()}_vs_${openerPosition.toUpperCase()}`;

    const rangeData = THREE_BET_RANGES[key];
    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    // Check 3bet range first
    const threeBetFreq = rangeData['3bet']?.[normalized] || 0;
    if (threeBetFreq >= 0.5) {
        return {
            found: true,
            action: { action: '3bet', frequency: threeBetFreq, sizing: '11bb' },
            scenario: key,
            source: 'range_table',
        };
    }

    // Check call range
    const callFreq = rangeData['call']?.[normalized] || 0;
    if (callFreq >= 0.5) {
        return {
            found: true,
            action: { action: 'call', frequency: callFreq },
            scenario: key,
            source: 'range_table',
        };
    }

    // Mixed strategy or fold
    if (threeBetFreq > 0 || callFreq > 0) {
        // Return the higher frequency action
        if (threeBetFreq > callFreq) {
            return {
                found: true,
                action: { action: '3bet', frequency: threeBetFreq, sizing: '11bb' },
                scenario: key,
                source: 'range_table',
            };
        } else {
            return {
                found: true,
                action: { action: 'call', frequency: callFreq },
                scenario: key,
                source: 'range_table',
            };
        }
    }

    // Fold
    return {
        found: true,
        action: { action: 'fold', frequency: 1.0 },
        scenario: key,
        source: 'range_table',
    };
}

/**
 * Get action when facing a 3bet (after opening)
 */
export function getVs3BetAction(
    hand: string,
    heroPosition: string,
    threeBettorPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const key = `${heroPosition.toUpperCase()}_vs_${threeBettorPosition.toUpperCase()}_3bet`;

    const rangeData = VS_THREE_BET_RANGES[key];
    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    // Check 4bet range
    const fourBetFreq = rangeData['4bet']?.[normalized] || 0;
    if (fourBetFreq >= 0.5) {
        return {
            found: true,
            action: { action: '4bet', frequency: fourBetFreq, sizing: '24bb' },
            scenario: key,
            source: 'range_table',
        };
    }

    // Check call range
    const callFreq = rangeData['call']?.[normalized] || 0;
    if (callFreq >= 0.5) {
        return {
            found: true,
            action: { action: 'call', frequency: callFreq },
            scenario: key,
            source: 'range_table',
        };
    }

    // Mixed or fold
    if (fourBetFreq > 0 || callFreq > 0) {
        if (fourBetFreq > callFreq) {
            return {
                found: true,
                action: { action: '4bet', frequency: fourBetFreq, sizing: '24bb' },
                scenario: key,
                source: 'range_table',
            };
        } else {
            return {
                found: true,
                action: { action: 'call', frequency: callFreq },
                scenario: key,
                source: 'range_table',
            };
        }
    }

    // Fold
    return {
        found: true,
        action: { action: 'fold', frequency: 1.0 },
        scenario: key,
        source: 'range_table',
    };
}

/**
 * Main function: Get preflop action based on game context
 */
export function getPreflopAction(
    hand: string,
    heroPosition: string,
    villainContext?: { type: string; villain: string | null }
): RangeResult {
    // Opening scenario (first to act)
    if (!villainContext || villainContext.type === 'opening') {
        return getOpeningAction(hand, heroPosition);
    }

    // Facing action
    if (villainContext.type === 'facing_action' && villainContext.villain) {
        return getFacingOpenAction(hand, heroPosition, villainContext.villain);
    }

    // SB vs BB
    if (villainContext.type === 'sb_vs_bb') {
        return getOpeningAction(hand, 'SB');
    }

    // Fallback
    return {
        found: false,
        action: { action: 'fold', frequency: 1.0 },
        scenario: 'unknown',
        source: 'llm_fallback',
    };
}

/**
 * Check if a hand is in any opening range for a position
 */
export function isInOpeningRange(hand: string, position: string): boolean {
    const result = getOpeningAction(hand, position);
    return result.found && result.action.action === 'raise';
}

/**
 * Get opening frequency for a hand at a position
 */
export function getOpeningFrequency(hand: string, position: string): number {
    const normalized = normalizeHand(hand);
    const posKey = normalizePosition(position);

    return RFI_RANGES[posKey]?.[normalized] || 0;
}
