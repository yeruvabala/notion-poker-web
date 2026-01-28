/**
 * GTO Preflop Ranges V2 for 6-Max Cash Games
 * 
 * Source: GTO Wizard - 100bb 6-max Cash, Simple 3x, 3b GTO
 * 
 * This file provides range-based preflop decision making extracted
 * directly from GTO Wizard solver outputs.
 * 
 * FORMAT MATCHES gtoRanges.ts for agent compatibility
 */

// =============================================================================
// TYPES (Re-exported for compatibility)
// =============================================================================

export interface RangeAction {
    action: 'raise' | 'call' | 'fold' | '3bet' | '4bet' | '5bet';
    frequency: number;  // 0.0 to 1.0
    sizing?: string;    // e.g., "2.5bb", "3bb"
}

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface RangeResult {
    found: boolean;
    action: RangeAction;
    scenario: string;
    source: 'range_table' | 'llm_fallback';
}

// =============================================================================
// HAND NORMALIZATION (copied from gtoRanges.ts for standalone use)
// =============================================================================

export function normalizeHand(hand: string): string {
    const cleaned = hand.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length === 3 && (cleaned.endsWith('S') || cleaned.endsWith('O'))) {
        return cleaned.slice(0, 2) + cleaned.slice(2).toLowerCase();
    }
    if (cleaned.length === 2 && cleaned[0] === cleaned[1]) {
        return cleaned;
    }
    const cardPattern = /([2-9TJQKA])([♠♥♦♣SHDC])/gi;
    const matches = [...cleaned.matchAll(cardPattern)];
    if (matches.length < 2) {
        if (cleaned.length === 2) return cleaned;
        return cleaned.slice(0, 2).toUpperCase();
    }
    const rank1 = matches[0][1].toUpperCase();
    const suit1 = matches[0][2].toUpperCase();
    const rank2 = matches[1][1].toUpperCase();
    const suit2 = matches[1][2].toUpperCase();
    const normSuit = (s: string) => ({ '♠': 's', 'S': 's', '♥': 'h', 'H': 'h', '♦': 'd', 'D': 'd', '♣': 'c', 'C': 'c' }[s] || s.toLowerCase());
    const rankOrder = '23456789TJQKA';
    const val1 = rankOrder.indexOf(rank1);
    const val2 = rankOrder.indexOf(rank2);
    if (rank1 === rank2) return `${rank1}${rank2}`;
    const [high, low] = val1 > val2 ? [rank1, rank2] : [rank2, rank1];
    const suited = normSuit(suit1) === normSuit(suit2);
    return `${high}${low}${suited ? 's' : 'o'}`;
}

export function normalizePosition(position: string): string {
    const posUpper = position.toUpperCase().replace(/\s+/g, '');
    const positionMap: Record<string, string> = {
        'BTN': 'BTN', 'BU': 'BTN', 'BUTTON': 'BTN', 'D': 'BTN', 'DEALER': 'BTN',
        'CO': 'CO', 'CUTOFF': 'CO',
        'HJ': 'HJ', 'HIJACK': 'HJ', 'MP': 'HJ', 'MP1': 'HJ', 'MP2': 'HJ', 'LJ': 'HJ', 'LOJACK': 'HJ',
        'UTG': 'UTG', 'EP': 'UTG', 'EARLYPOSITION': 'UTG', 'UTG+1': 'UTG', 'UTG1': 'UTG', 'UTG+2': 'UTG', 'UTG2': 'UTG',
        'SB': 'SB', 'SMALLBLIND': 'SB',
        'BB': 'BB', 'BIGBLIND': 'BB',
    };
    return positionMap[posUpper] || posUpper;
}

// =============================================================================
// RFI (RAISE FIRST IN) RANGES - 6-MAX 100BB
// Source: GTO Wizard Screenshots
// =============================================================================

export const RFI_RANGES_V2: Record<string, Record<string, number>> = {

    // =========================================================================
    // UTG RFI - 16.4% of hands, Raise 3x
    // =========================================================================
    UTG: {
        // Pairs - All premium pairs, small pairs fold
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 0.67, '55': 0.32,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.67,
        'A8s': 0.32, 'A7s': 0.32, 'A6s': 0.32, 'A5s': 1.0, 'A4s': 0.67,
        'A3s': 0.32, 'A2s': 0.32,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.32,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.32,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 0.32,
        // Suited Connectors
        'T9s': 1.0, 'T8s': 0.32,
        '98s': 0.67, '87s': 0.67, '76s': 0.67, '65s': 0.32, '54s': 0.32,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 0.67,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 0.67,
        // Offsuit Queens
        'QJo': 0.32,
    },

    // =========================================================================
    // HJ RFI - 20.3% of hands, Raise 3x
    // =========================================================================
    HJ: {
        // Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 0.67,
        '44': 0.32,
        // Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 0.67, 'A7s': 0.67, 'A6s': 0.67, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 0.67, 'A2s': 0.67,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.67, 'K8s': 0.32,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.67,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 0.67, 'J8s': 0.32,
        // Suited Connectors
        'T9s': 1.0, 'T8s': 0.67,
        '98s': 1.0, '97s': 0.32, '87s': 1.0, '76s': 1.0, '65s': 0.67, '54s': 0.67,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 0.32,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 0.32,
        // Offsuit Queens
        'QJo': 0.67, 'QTo': 0.32,
        // Offsuit Jacks
        'JTo': 0.32,
    },

    // =========================================================================
    // CO RFI - 26.9% of hands, Raise 3x
    // =========================================================================
    CO: {
        // All Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 0.67, '33': 0.32, '22': 0.32,
        // Suited Aces - All
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        // Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 0.67,
        'K7s': 0.32, 'K6s': 0.32, 'K5s': 0.32,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 0.67, 'Q7s': 0.32,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 0.67,
        // Suited Tens
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 0.32,
        // Suited Connectors
        '98s': 1.0, '97s': 0.67, '87s': 1.0, '86s': 0.32,
        '76s': 1.0, '75s': 0.32, '65s': 1.0, '64s': 0.32,
        '54s': 1.0, '53s': 0.32, '43s': 0.32,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 0.67,
        'A8o': 0.32, 'A7o': 0.32, 'A6o': 0.32, 'A5o': 0.32,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 0.32,
        // Offsuit Queens
        'QJo': 1.0, 'QTo': 0.67,
        // Offsuit Jacks
        'JTo': 0.67,
    },

    // =========================================================================
    // BTN RFI - 40.8% of hands, Raise 3x
    // =========================================================================
    BTN: {
        // All Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 1.0, '33': 1.0, '22': 1.0,
        // All Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        // All Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 1.0, 'K4s': 0.67, 'K3s': 0.67, 'K2s': 0.67,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 0.67,
        'Q6s': 0.67, 'Q5s': 0.67, 'Q4s': 0.32, 'Q3s': 0.32,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 0.67, 'J6s': 0.32,
        // Suited Tens
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 0.67, 'T6s': 0.32,
        // Suited Connectors
        '98s': 1.0, '97s': 1.0, '96s': 0.32,
        '87s': 1.0, '86s': 0.67, '85s': 0.32,
        '76s': 1.0, '75s': 0.67, '74s': 0.32,
        '65s': 1.0, '64s': 0.67, '63s': 0.32,
        '54s': 1.0, '53s': 0.67, '52s': 0.32,
        '43s': 0.67, '42s': 0.32,
        '32s': 0.32,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 1.0,
        'A8o': 1.0, 'A7o': 1.0, 'A6o': 0.67, 'A5o': 1.0, 'A4o': 0.67,
        'A3o': 0.67, 'A2o': 0.32,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 1.0, 'K8o': 0.67,
        'K7o': 0.32, 'K6o': 0.32,
        // Offsuit Queens
        'QJo': 1.0, 'QTo': 1.0, 'Q9o': 0.67, 'Q8o': 0.32,
        // Offsuit Jacks
        'JTo': 1.0, 'J9o': 0.67, 'J8o': 0.32,
        // Offsuit Tens
        'T9o': 0.67, 'T8o': 0.32,
        // Offsuit Connectors
        '98o': 0.32, '87o': 0.32, '76o': 0.32,
    },

    // =========================================================================
    // SB RFI (vs BB only) - 43.1% of hands, Raise 3.5x
    // =========================================================================
    SB: {
        // All Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0,
        '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0,
        '44': 1.0, '33': 1.0, '22': 1.0,
        // All Suited Aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        // All Suited Kings
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 1.0, 'K4s': 1.0, 'K3s': 1.0, 'K2s': 1.0,
        // Suited Queens
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 1.0,
        'Q6s': 1.0, 'Q5s': 0.67, 'Q4s': 0.67, 'Q3s': 0.32, 'Q2s': 0.32,
        // Suited Jacks
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 1.0, 'J6s': 0.67, 'J5s': 0.32,
        // Suited Tens
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 1.0, 'T6s': 0.67, 'T5s': 0.32,
        // Suited Nines+
        '98s': 1.0, '97s': 1.0, '96s': 0.67, '95s': 0.32,
        '87s': 1.0, '86s': 1.0, '85s': 0.32,
        '76s': 1.0, '75s': 0.67, '74s': 0.32,
        '65s': 1.0, '64s': 0.67, '63s': 0.32,
        '54s': 1.0, '53s': 0.67, '52s': 0.32,
        '43s': 0.67, '42s': 0.32,
        '32s': 0.32,
        // Offsuit Aces
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 1.0,
        'A8o': 1.0, 'A7o': 1.0, 'A6o': 1.0, 'A5o': 1.0, 'A4o': 1.0,
        'A3o': 1.0, 'A2o': 0.67,
        // Offsuit Kings
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 1.0, 'K8o': 1.0,
        'K7o': 0.67, 'K6o': 0.67, 'K5o': 0.32, 'K4o': 0.32,
        // Offsuit Queens
        'QJo': 1.0, 'QTo': 1.0, 'Q9o': 1.0, 'Q8o': 0.67, 'Q7o': 0.32,
        // Offsuit Jacks
        'JTo': 1.0, 'J9o': 1.0, 'J8o': 0.32,
        // Offsuit Tens
        'T9o': 1.0, 'T8o': 0.67,
        // Offsuit Connectors
        '98o': 0.67, '97o': 0.32,
        '87o': 0.67, '86o': 0.32,
        '76o': 0.67, '75o': 0.32,
        '65o': 0.32, '54o': 0.32,
    },

    // MP alias for HJ (6-max)
    MP: {},
};

// Copy HJ to MP for 6-max compatibility
RFI_RANGES_V2.MP = { ...RFI_RANGES_V2.HJ };

// =============================================================================
// 3-BET RANGES (When facing an open raise)
// To be populated from additional screenshots
// =============================================================================

export const THREE_BET_RANGES_V2: Record<string, Record<string, Record<string, number>>> = {

    // =========================================================================
    // BB vs SB (SB opens 3.5x) - Widest defense
    // Raise 10.5: 16.3%, Call: 42.1%, Fold: 41.6%
    // =========================================================================
    'BB_vs_SB': {
        '3bet': {
            // Premium value 3-bets
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 0.5,
            'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.6,
            'KQs': 1.0, 'KJs': 0.5,
            'AKo': 1.0, 'AQo': 1.0, 'AJo': 0.6,
            'KQo': 0.5,
            // Bluff 3-bets
            'A5s': 1.0, 'A4s': 0.8, 'A3s': 0.6, 'A2s': 0.4,
            'QJs': 0.4, 'JTs': 0.4, 'T9s': 0.3,
        },
        'call': {
            // Pairs
            'TT': 0.5, '99': 1.0, '88': 1.0, '77': 1.0, '66': 1.0,
            '55': 1.0, '44': 1.0, '33': 1.0, '22': 1.0,
            // Suited Aces
            'ATs': 0.4, 'A9s': 1.0, 'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0,
            'A5s': 0.0, 'A4s': 0.2, 'A3s': 0.4, 'A2s': 0.6,
            // Suited Kings
            'KJs': 0.5, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0, 'K7s': 1.0,
            'K6s': 1.0, 'K5s': 1.0, 'K4s': 1.0, 'K3s': 1.0, 'K2s': 1.0,
            // Suited Queens
            'QJs': 0.6, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 1.0,
            'Q6s': 1.0, 'Q5s': 1.0, 'Q4s': 1.0, 'Q3s': 1.0, 'Q2s': 1.0,
            // Suited Jacks
            'JTs': 0.6, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 1.0, 'J6s': 1.0,
            'J5s': 0.8, 'J4s': 0.6,
            // Suited Tens+
            'T9s': 0.7, 'T8s': 1.0, 'T7s': 1.0, 'T6s': 0.8,
            '98s': 1.0, '97s': 1.0, '96s': 0.8,
            '87s': 1.0, '86s': 1.0, '85s': 0.6,
            '76s': 1.0, '75s': 1.0, '74s': 0.5,
            '65s': 1.0, '64s': 1.0, '63s': 0.4,
            '54s': 1.0, '53s': 0.8, '52s': 0.4,
            '43s': 0.7, '42s': 0.3,
            '32s': 0.3,
            // Offsuit
            'AJo': 0.4, 'ATo': 1.0, 'A9o': 1.0, 'A8o': 1.0, 'A7o': 1.0,
            'A6o': 1.0, 'A5o': 1.0, 'A4o': 1.0, 'A3o': 1.0, 'A2o': 0.8,
            'KQo': 0.5, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 1.0, 'K8o': 1.0,
            'K7o': 0.8, 'K6o': 0.6, 'K5o': 0.4,
            'QJo': 1.0, 'QTo': 1.0, 'Q9o': 1.0, 'Q8o': 0.7, 'Q7o': 0.4,
            'JTo': 1.0, 'J9o': 1.0, 'J8o': 0.6,
            'T9o': 1.0, 'T8o': 0.7,
            '98o': 0.8, '97o': 0.4,
            '87o': 0.6, '76o': 0.5, '65o': 0.4, '54o': 0.3,
        },
    },

    // =========================================================================
    // BB vs BTN (BTN opens 3x) - Second widest
    // Raise 13.5: 13.2%, Call: 27.6%, Fold: 59.2%
    // =========================================================================
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
            'JTs': 1.0, 'J9s': 1.0, 'J8s': 0.8,
            'T9s': 1.0, 'T8s': 1.0,
            '98s': 1.0, '97s': 0.9, '87s': 1.0, '86s': 0.8,
            '76s': 1.0, '75s': 0.6, '65s': 1.0, '54s': 1.0, '43s': 0.7,
            'AQo': 0.3, 'AJo': 0.8, 'ATo': 1.0, 'A9o': 0.8,
            'KQo': 0.8, 'KJo': 1.0, 'KTo': 0.9,
            'QJo': 1.0, 'QTo': 0.8, 'JTo': 1.0, 'T9o': 0.7,
        },
    },

    // =========================================================================
    // BB vs CO (CO opens 3x)
    // Raise 14: 8.9%, Call: 20.8%, Fold: 70.3%
    // =========================================================================
    'BB_vs_CO': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.5,
            'AKs': 1.0, 'AQs': 0.7,
            'A5s': 0.6, 'A4s': 0.4,
            'AKo': 1.0, 'AQo': 0.5,
        },
        'call': {
            'JJ': 0.5, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 1.0,
            '66': 1.0, '55': 1.0, '44': 0.8, '33': 0.6, '22': 0.5,
            'AQs': 0.3, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.9, 'A8s': 0.8,
            'A5s': 0.4, 'A4s': 0.6, 'A3s': 0.9, 'A2s': 0.8,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.8,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.7,
            'JTs': 1.0, 'J9s': 0.9, 'T9s': 1.0, 'T8s': 0.8,
            '98s': 1.0, '87s': 1.0, '76s': 0.9, '65s': 0.8, '54s': 0.7,
            'AQo': 0.5, 'AJo': 1.0, 'ATo': 0.8,
            'KQo': 1.0, 'KJo': 0.9, 'QJo': 0.8,
        },
    },

    // =========================================================================
    // BB vs HJ (HJ opens 3x)
    // Raise 14: 6.9%, Call: 18.2%, Fold: 74.9%
    // =========================================================================
    'BB_vs_HJ': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.4,
            'AKs': 1.0, 'AQs': 0.5,
            'A5s': 0.5, 'A4s': 0.3,
            'AKo': 1.0, 'AQo': 0.3,
        },
        'call': {
            'JJ': 0.6, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 1.0,
            '66': 0.9, '55': 0.7, '44': 0.5, '33': 0.3, '22': 0.2,
            'AQs': 0.5, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.7, 'A8s': 0.5,
            'A5s': 0.5, 'A4s': 0.7, 'A3s': 0.6, 'A2s': 0.5,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.9, 'K9s': 0.5,
            'QJs': 1.0, 'QTs': 0.9, 'Q9s': 0.4,
            'JTs': 1.0, 'J9s': 0.6, 'T9s': 0.9, 'T8s': 0.5,
            '98s': 0.8, '87s': 0.7, '76s': 0.6, '65s': 0.5, '54s': 0.4,
            'AQo': 0.7, 'AJo': 1.0, 'ATo': 0.6,
            'KQo': 1.0, 'KJo': 0.7, 'QJo': 0.5,
        },
    },

    // =========================================================================
    // BB vs UTG (UTG opens 3x) - Tightest defense
    // Raise 14: 5.4%, Call: 16.8%, Fold: 77.8%
    // =========================================================================
    'BB_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8, 'JJ': 0.3,
            'AKs': 1.0, 'AQs': 0.4,
            'AKo': 0.9,
            'A5s': 0.3,
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
// To be populated from additional screenshots
// =============================================================================

export const VS_THREE_BET_RANGES_V2: Record<string, Record<string, Record<string, number>>> = {
    // Placeholder - will be populated with vs 3-bet spots
};

// =============================================================================
// AGGREGATE SPOT STATS
// Overall action frequencies for entire range (for pot odds / EV calculations)
// Source: GTO Wizard - shows what % of total range takes each action
// =============================================================================

export interface SpotStats {
    raise: number;      // % of range that raises/3-bets
    call: number;       // % of range that calls
    fold: number;       // % of range that folds
    raiseSize?: string; // e.g., "3x", "10.5bb"
    combos?: {          // Optional: exact combo counts
        raise: number;
        call: number;
        fold: number;
    };
}

export const SPOT_AGGREGATE_STATS: Record<string, SpotStats> = {
    // =========================================================================
    // RFI Stats (Raise vs Fold only from unopened pot)
    // =========================================================================
    'RFI_UTG': { raise: 0.164, call: 0, fold: 0.836, raiseSize: '3x' },
    'RFI_HJ': { raise: 0.203, call: 0, fold: 0.797, raiseSize: '3x' },
    'RFI_CO': { raise: 0.269, call: 0, fold: 0.731, raiseSize: '3x' },
    'RFI_BTN': { raise: 0.408, call: 0, fold: 0.592, raiseSize: '3x' },
    'RFI_SB': { raise: 0.431, call: 0, fold: 0.569, raiseSize: '3.5x' },

    // =========================================================================
    // BB Facing Raise Stats (3-bet vs Call vs Fold)
    // =========================================================================
    'BB_vs_SB': { raise: 0.163, call: 0.421, fold: 0.416, raiseSize: '10.5bb' },
    'BB_vs_BTN': { raise: 0.132, call: 0.276, fold: 0.592, raiseSize: '13.5bb' },
    'BB_vs_CO': { raise: 0.089, call: 0.208, fold: 0.703, raiseSize: '14bb' },
    'BB_vs_HJ': { raise: 0.069, call: 0.182, fold: 0.749, raiseSize: '14bb' },
    'BB_vs_UTG': { raise: 0.054, call: 0.168, fold: 0.778, raiseSize: '14bb' },
};

// =============================================================================
// Helper function to get spot stats
// =============================================================================

export function getSpotStats(spot: string): SpotStats | undefined {
    return SPOT_AGGREGATE_STATS[spot];
}

/**
 * Calculate if a bluff is profitable based on fold frequency
 * @param spot - The spot key (e.g., 'BB_vs_BTN')
 * @param betSize - Bet size in bb
 * @param potSize - Current pot size in bb
 * @returns { profitable: boolean, breakeven: number, actualFold: number }
 */
export function isBluffProfitable(
    spot: string,
    betSize: number,
    potSize: number
): { profitable: boolean; breakeven: number; actualFold: number } {
    const stats = SPOT_AGGREGATE_STATS[spot];
    if (!stats) {
        return { profitable: false, breakeven: 0, actualFold: 0 };
    }

    // Breakeven fold % = bet / (bet + pot)
    const breakeven = betSize / (betSize + potSize);
    const actualFold = stats.fold;

    return {
        profitable: actualFold >= breakeven,
        breakeven,
        actualFold,
    };
}

// =============================================================================
// LOOKUP FUNCTIONS (Compatible with existing agent code)
// =============================================================================

/**
 * Get RFI action for a hand from a position
 * Returns frequency (0.0 to 1.0) or undefined if not in range
 */
export function getRFIAction(position: string, hand: string): number | undefined {
    const normPos = normalizePosition(position);
    const normHand = normalizeHand(hand);
    return RFI_RANGES_V2[normPos]?.[normHand];
}

/**
 * Check if a hand should RFI from a position
 * Returns true if in range with any frequency > 0
 */
export function shouldRFI(position: string, hand: string, threshold: number = 0.0): boolean {
    const freq = getRFIAction(position, hand);
    return freq !== undefined && freq > threshold;
}

/**
 * Get 3-bet or call action when facing an open
 * Returns { action: '3bet'|'call'|'fold', frequency: number }
 */
export function getFacingRaiseAction(
    heroPosition: string,
    villainPosition: string,
    hand: string
): { action: '3bet' | 'call' | 'fold'; frequency: number } {
    const key = `${normalizePosition(heroPosition)}_vs_${normalizePosition(villainPosition)}`;
    const normHand = normalizeHand(hand);

    const spot = THREE_BET_RANGES_V2[key];
    if (!spot) {
        return { action: 'fold', frequency: 1.0 };
    }

    const threeBetFreq = spot['3bet']?.[normHand] || 0;
    const callFreq = spot['call']?.[normHand] || 0;

    if (threeBetFreq > callFreq && threeBetFreq > 0) {
        return { action: '3bet', frequency: threeBetFreq };
    } else if (callFreq > 0) {
        return { action: 'call', frequency: callFreq };
    }
    return { action: 'fold', frequency: 1.0 };
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
    RFI_RANGES: RFI_RANGES_V2,
    THREE_BET_RANGES: THREE_BET_RANGES_V2,
    VS_THREE_BET_RANGES: VS_THREE_BET_RANGES_V2,
    SPOT_AGGREGATE_STATS,
    getRFIAction,
    shouldRFI,
    getFacingRaiseAction,
    getSpotStats,
    isBluffProfitable,
    normalizeHand,
    normalizePosition,
};
