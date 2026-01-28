/**
 * GTO Preflop Ranges V2 for 6-Max Cash Games
 * 
 * Source: GTO Wizard - 100bb 6-max Cash, Simple 3x, 3b GTO
 * 
 * This file provides range-based preflop decision making extracted
 * directly from GTO Wizard solver outputs.
 * 
 * ============================================================================
 * CRITICAL: UNDERSTANDING RANGE HIERARCHY (READ BEFORE INTEGRATION!)
 * ============================================================================
 * 
 * All frequencies in this file are RELATIVE TO THE PREVIOUS ACTION'S RANGE,
 * NOT absolute frequencies of all 1326 starting hand combinations.
 * 
 * EXAMPLE - BB facing UTG 4-bet:
 * 
 *   Step 1: UTG opens (RFI_RANGES_V2['UTG']) 
 *           → ~15% of all hands ≈ 199 combos
 * 
 *   Step 2: BB 3-bets (THREE_BET_RANGES_V2['BB_vs_UTG']['3bet'])
 *           → 5.4% of all hands ≈ 71 combos
 *           → These 71 combos are BB's 3-bet range
 * 
 *   Step 3: UTG 4-bets, BB now faces a decision
 *           (VS_FOUR_BET_RANGES_V2['BB_vs_UTG_4bet'])
 *           → All-in: 31.2% = 31.2% OF THE 71 COMBOS (≈22 combos), NOT 31.2% of 1326!
 *           → Call:   23.5% = 23.5% OF THE 71 COMBOS (≈17 combos)
 *           → Fold:   45.3% = 45.3% OF THE 71 COMBOS (≈32 combos)
 * 
 * HIERARCHY:
 *   1326 combos → RFI/Facing Open → 3-Bet Range → Facing 4-Bet → Facing 5-Bet
 *                        ↓                 ↓              ↓
 *                   % of 1326       % of 3-bet range  % of 4-bet range
 * 
 * FOR AI AGENTS - INTEGRATION NOTES:
 * 
 *   1. When evaluating a hand at a decision point, first verify the hand
 *      is in the previous action's range before checking current action.
 * 
 *   2. For hand like QQ in BB vs UTG 4-bet:
 *      - Check: THREE_BET_RANGES_V2['BB_vs_UTG']['3bet']['QQ'] → 0.5 (50% 3-bet)
 *      - Then:  VS_FOUR_BET_RANGES_V2['BB_vs_UTG_4bet']['allin']['QQ'] → 0.6
 *      - Meaning: Of the QQ combos that 3-bet, 60% go all-in vs 4-bet
 * 
 *   3. SPOT_AGGREGATE_STATS percentages also follow this pattern:
 *      - 'BB_vs_UTG_4bet': { raise: 0.312, call: 0.235, fold: 0.453 }
 *      - These sum to 1.0 because they represent 100% of the 3-bet range
 * 
 *   4. For quick lookups, use the getSpotStats() helper function.
 * 
 *   5. TODO for integration: Consider adding helper functions like:
 *      - getAbsoluteFrequency(hand, actionChain) → calculates compound probability
 *      - isHandInRange(hand, scenario) → validates hand is in previous range
 * 
 * ============================================================================
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

    // =========================================================================
    // SB vs UTG (UTG opens 3x) - Tightest SB defense
    // Raise 13: 6.8%, Fold: 93.2% (No calling range - SB should 3-bet or fold)
    // =========================================================================
    'SB_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.5,
            'AKs': 1.0, 'AQs': 0.5,
            'AKo': 1.0,
            'A5s': 0.3,
        },
        'call': {
            // SB has no calling range vs UTG - must 3-bet or fold
        },
    },

    // =========================================================================
    // SB vs HJ (HJ opens 3x)
    // Raise 13: 8%, Fold: 92%
    // =========================================================================
    'SB_vs_HJ': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AQs': 0.8, 'AJs': 0.3,
            'AKo': 1.0, 'AQo': 0.4,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            // SB has minimal/no calling range vs HJ
        },
    },

    // =========================================================================
    // SB vs CO (CO opens 3x)
    // Raise 13: 10.1%, Fold: 89.9%
    // =========================================================================
    'SB_vs_CO': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8, 'TT': 0.3,
            'AKs': 1.0, 'AQs': 1.0, 'AJs': 0.6,
            'AKo': 1.0, 'AQo': 0.7,
            'A5s': 0.7, 'A4s': 0.5, 'KJs': 0.3,
        },
        'call': {
            // SB has minimal calling range vs CO
        },
    },

    // =========================================================================
    // SB vs BTN (BTN opens 3x) - Widest SB defense
    // Raise 12: 14.3%, Fold: 85.7%
    // =========================================================================
    'SB_vs_BTN': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.9, 'TT': 0.5,
            'AKs': 1.0, 'AQs': 1.0, 'AJs': 0.8, 'ATs': 0.5,
            'A5s': 0.9, 'A4s': 0.7, 'A3s': 0.5,
            'KQs': 0.7, 'KJs': 0.4,
            'AKo': 1.0, 'AQo': 0.8,
        },
        'call': {
            // SB has minimal calling range vs BTN - mostly 3-bet or fold
        },
    },

    // =========================================================================
    // HJ vs UTG (UTG opens 3x, HJ 3-bets or folds)
    // Raise 9.5: 7.2%, Fold: 92.8% (No calling range)
    // =========================================================================
    'HJ_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8, 'JJ': 0.3,
            'AKs': 1.0, 'AQs': 0.4,
            'AKo': 0.9,
            'A5s': 0.4, 'A4s': 0.2,
        },
        'call': {
            // HJ has minimal/no calling range vs UTG - must 3-bet or fold
        },
    },

    // =========================================================================
    // CO vs UTG (UTG opens 3x, CO 3-bets or folds)
    // Raise 9.5: 7.6%, Fold: 92.4% (No calling range)
    // =========================================================================
    'CO_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8, 'JJ': 0.3,
            'AKs': 1.0, 'AQs': 0.5,
            'AKo': 1.0,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            // CO has no calling range vs UTG open - must 3-bet or fold
        },
    },

    // =========================================================================
    // CO vs HJ (HJ opens 3x, CO 3-bets or folds)
    // Raise 9.5: 8.8%, Fold: 91.2% (No calling range)
    // =========================================================================
    'CO_vs_HJ': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.9, 'JJ': 0.4, 'TT': 0.2,
            'AKs': 1.0, 'AQs': 0.6, 'AJs': 0.2,
            'AKo': 1.0, 'AQo': 0.3,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            // CO has no calling range vs HJ open - must 3-bet or fold
        },
    },

    // =========================================================================
    // BTN vs UTG (UTG opens 3x, BTN can 3-bet, call, or fold)
    // Raise 10: 5.5%, Call: 10%, Fold: 84.6%
    // =========================================================================
    'BTN_vs_UTG': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.5,
            'AKs': 1.0, 'AKo': 0.8,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.5, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.6,
            '77': 0.4, '66': 0.3,
            'AQs': 1.0, 'AJs': 0.8, 'ATs': 0.5,
            'KQs': 0.8, 'KJs': 0.5, 'QJs': 0.4,
            'JTs': 0.5, 'T9s': 0.4, '98s': 0.3,
            'AKo': 0.2, 'AQo': 0.5,
        },
    },

    // =========================================================================
    // BTN vs HJ (HJ opens 3x, BTN can 3-bet, call, or fold)
    // Raise 10: 6.5%, Call: 10.4%, Fold: 83%
    // =========================================================================
    'BTN_vs_HJ': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6, 'JJ': 0.2,
            'AKs': 1.0, 'AKo': 0.9,
            'KQs': 0.17,  // Mixed: 17% 3-bet (from GTO screenshot)
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.4, 'JJ': 0.8, 'TT': 1.0, '99': 0.9, '88': 0.7,
            '77': 0.5, '66': 0.3, '55': 0.2,
            'AQs': 1.0, 'AJs': 0.9, 'ATs': 0.7,
            'KQs': 0.83,  // Mixed: 83% call (from GTO screenshot)
            'KJs': 0.7, 'KTs': 0.4,
            'QJs': 0.6, 'QTs': 0.4,
            'JTs': 0.6, 'T9s': 0.5, '98s': 0.4, '87s': 0.3,
            'AKo': 0.1, 'AQo': 0.6, 'AJo': 0.3,
        },
    },

    // =========================================================================
    // BTN vs CO (CO opens 3x, BTN can 3-bet, call, or fold)
    // Raise 10: 8.4%, Call: 11%, Fold: 80.7%
    // =========================================================================
    'BTN_vs_CO': {
        '3bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8, 'JJ': 0.3,
            'AKs': 1.0, 'AKo': 1.0,
            'A5s': 0.8, 'A4s': 0.6, 'A3s': 0.3,
            'KQs': 0.3,
        },
        'call': {
            'QQ': 0.2, 'JJ': 0.7, 'TT': 1.0, '99': 1.0, '88': 0.8,
            '77': 0.6, '66': 0.4, '55': 0.3,
            'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.8,
            'A5s': 0.2, 'A4s': 0.4,
            'KQs': 0.7, 'KJs': 0.8, 'KTs': 0.5,
            'QJs': 0.7, 'QTs': 0.5,
            'JTs': 0.7, 'T9s': 0.6, '98s': 0.5, '87s': 0.4, '76s': 0.3,
            'AQo': 0.7, 'AJo': 0.4, 'KQo': 0.4,
        },
    },
};

// Add BB_vs_MP alias (MP = HJ in 6-max) for V1 compatibility
THREE_BET_RANGES_V2['BB_vs_MP'] = THREE_BET_RANGES_V2['BB_vs_HJ'];

// =============================================================================
// VS 3-BET RANGES (When you open and face a 3bet)
// To be populated from additional screenshots
// =============================================================================

export const VS_THREE_BET_RANGES_V2: Record<string, Record<string, Record<string, number>>> = {

    // =========================================================================
    // UTG vs HJ 3-bet (UTG opens, HJ 3-bets)
    // 4-bet: 20.1%, Call: 21.1%, Fold: 58.8%
    // =========================================================================
    'UTG_vs_HJ_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'A5s': 0.7, 'A4s': 0.5,
        },
        'call': {
            'QQ': 0.2, 'JJ': 1.0, 'TT': 1.0, '99': 0.6,
            'AQs': 1.0, 'AJs': 0.8,
            'KQs': 0.8,
            'AQo': 0.6,
        },
    },

    // =========================================================================
    // UTG vs CO 3-bet (UTG opens, CO 3-bets)
    // 4-bet: 22.1%, Call: 19.8%, Fold: 58.1%
    // =========================================================================
    'UTG_vs_CO_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.9,
            'AKs': 1.0, 'AKo': 1.0,
            'A5s': 0.8, 'A4s': 0.6,
        },
        'call': {
            'QQ': 0.1, 'JJ': 1.0, 'TT': 1.0, '99': 0.5,
            'AQs': 1.0, 'AJs': 0.7,
            'KQs': 0.7,
            'AQo': 0.5,
        },
    },

    // =========================================================================
    // UTG vs BTN 3-bet (UTG opens, BTN 3-bets)
    // 4-bet: 18%, Call: 30.5%, Fold: 51.5%
    // =========================================================================
    'UTG_vs_BTN_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6,
            'AKs': 1.0, 'AKo': 0.9,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.4, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.7, '77': 0.4,
            'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.7,
            'KQs': 1.0, 'KJs': 0.6,
            'QJs': 0.5, 'JTs': 0.4, 'T9s': 0.3,
            'AKo': 0.1, 'AQo': 0.8, 'AJo': 0.4,
        },
    },

    // =========================================================================
    // UTG vs SB 3-bet (UTG opens, SB 3-bets)
    // 4-bet: 10.5%, Call: 32.2%, Fold: 57.3%
    // =========================================================================
    'UTG_vs_SB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.3,
            'AKs': 0.8, 'AKo': 0.5,
            'A5s': 0.3,
        },
        'call': {
            'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.9, '77': 0.6,
            'AKs': 0.2, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.8,
            'KQs': 1.0, 'KJs': 0.8, 'KTs': 0.4,
            'QJs': 0.7, 'QTs': 0.4,
            'JTs': 0.6, 'T9s': 0.4, '98s': 0.3,
            'AKo': 0.5, 'AQo': 0.9, 'AJo': 0.6,
        },
    },

    // =========================================================================
    // UTG vs BB 3-bet (UTG opens, BB 3-bets)
    // 4-bet: 7.5%, Call: 35.6%, Fold: 56.9%
    // =========================================================================
    'UTG_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.2,
            'AKs': 0.6, 'AKo': 0.3,
            'A5s': 0.2,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.7, '66': 0.4,
            'AKs': 0.4, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.9,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.6,
            'QJs': 0.9, 'QTs': 0.5,
            'JTs': 0.8, 'T9s': 0.6, '98s': 0.4, '87s': 0.3,
            'AKo': 0.7, 'AQo': 1.0, 'AJo': 0.7, 'KQo': 0.5,
        },
    },

    // =========================================================================
    // HJ vs CO 3-bet (HJ opens, CO 3-bets)
    // 4-bet: 20.7%, Call: 20.7%, Fold: 58.6%
    // =========================================================================
    'HJ_vs_CO_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'A5s': 0.7, 'A4s': 0.5,
        },
        'call': {
            'QQ': 0.2, 'JJ': 1.0, 'TT': 1.0, '99': 0.6,
            'AQs': 1.0, 'AJs': 0.8,
            'KQs': 0.9,
            'AQo': 0.6,
        },
    },

    // =========================================================================
    // HJ vs BTN 3-bet (HJ opens, BTN 3-bets)
    // 4-bet: 17.9%, Call: 29.1%, Fold: 53%
    // =========================================================================
    'HJ_vs_BTN_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6,
            'AKs': 1.0, 'AKo': 0.8,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.4, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.8, '77': 0.5,
            'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.8,
            'KQs': 1.0, 'KJs': 0.7, 'KTs': 0.4,
            'QJs': 0.6, 'QTs': 0.3,
            'JTs': 0.5, 'T9s': 0.4, '98s': 0.3,
            'AKo': 0.2, 'AQo': 0.9, 'AJo': 0.5, 'KQo': 0.3,
        },
    },

    // =========================================================================
    // HJ vs SB 3-bet (HJ opens, SB 3-bets)
    // 4-bet: 10%, Call: 32.6%, Fold: 57.4%
    // =========================================================================
    'HJ_vs_SB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.3,
            'AKs': 0.7, 'AKo': 0.4,
            'A5s': 0.3,
        },
        'call': {
            'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.7, '66': 0.4,
            'AKs': 0.3, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.9,
            'KQs': 1.0, 'KJs': 0.9, 'KTs': 0.5,
            'QJs': 0.8, 'QTs': 0.5,
            'JTs': 0.7, 'T9s': 0.5, '98s': 0.4, '87s': 0.3,
            'AKo': 0.6, 'AQo': 0.9, 'AJo': 0.6, 'KQo': 0.4,
        },
    },

    // =========================================================================
    // HJ vs BB 3-bet (HJ opens, BB 3-bets)
    // 4-bet: 7.4%, Call: 35.8%, Fold: 56.9%
    // =========================================================================
    'HJ_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.2,
            'AKs': 0.5, 'AKo': 0.3,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.8, '66': 0.5, '55': 0.3,
            'AKs': 0.5, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.4,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.7,
            'QJs': 1.0, 'QTs': 0.6,
            'JTs': 0.9, 'T9s': 0.7, '98s': 0.5, '87s': 0.4, '76s': 0.3,
            'AKo': 0.7, 'AQo': 1.0, 'AJo': 0.8, 'KQo': 0.6,
        },
    },

    // =========================================================================
    // CO vs BTN 3-bet (CO opens, BTN 3-bets)
    // 4-bet: 17.5%, Call: 27.8%, Fold: 54.7%
    // =========================================================================
    'CO_vs_BTN_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6,
            'AKs': 1.0, 'AKo': 0.8,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.4, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.8, '77': 0.6,
            'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.9,
            'KQs': 1.0, 'KJs': 0.8, 'KTs': 0.5,
            'QJs': 0.7, 'QTs': 0.4,
            'JTs': 0.6, 'T9s': 0.5, '98s': 0.3,
            'AKo': 0.2, 'AQo': 0.9, 'AJo': 0.6, 'KQo': 0.4,
        },
    },

    // =========================================================================
    // CO vs SB 3-bet (CO opens, SB 3-bets)
    // 4-bet: 10.5%, Call: 30.6%, Fold: 58.9%
    // =========================================================================
    'CO_vs_SB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.3,
            'AKs': 0.7, 'AKo': 0.5,
            'A5s': 0.3,
        },
        'call': {
            'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.8, '66': 0.5,
            'AKs': 0.3, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.4,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.6,
            'QJs': 0.9, 'QTs': 0.5,
            'JTs': 0.8, 'T9s': 0.6, '98s': 0.4, '87s': 0.3,
            'AKo': 0.5, 'AQo': 0.9, 'AJo': 0.6, 'KQo': 0.4,
        },
    },

    // =========================================================================
    // CO vs BB 3-bet (CO opens, BB 3-bets)
    // 4-bet: 8.4%, Call: 33.4%, Fold: 58.2%
    // =========================================================================
    'CO_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 0.9, 'QQ': 0.2,
            'AKs': 0.6, 'AKo': 0.4,
            'A5s': 0.2,
        },
        'call': {
            'KK': 0.1, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.9, '66': 0.6, '55': 0.4,
            'AKs': 0.4, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.5, 'A8s': 0.3,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.8,
            'QJs': 1.0, 'QTs': 0.7,
            'JTs': 1.0, 'T9s': 0.8, '98s': 0.6, '87s': 0.5, '76s': 0.4,
            'AKo': 0.6, 'AQo': 1.0, 'AJo': 0.8, 'ATo': 0.4, 'KQo': 0.6, 'KJo': 0.3,
        },
    },

    // =========================================================================
    // BTN vs SB 3-bet (BTN opens, SB 3-bets)
    // 4-bet: 8.9%, Call: 40.7%, Fold: 50.4%
    // =========================================================================
    'BTN_vs_SB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.2,
            'AKs': 0.5, 'AKo': 0.3,
            'A5s': 0.3,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 1.0, '66': 0.8, '55': 0.6, '44': 0.4,
            'AKs': 0.5, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.8, 'A8s': 0.6, 'A7s': 0.4,
            'A5s': 0.7, 'A4s': 0.9, 'A3s': 0.7, 'A2s': 0.5,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.6,
            'QJs': 1.0, 'QTs': 0.9, 'Q9s': 0.5,
            'JTs': 1.0, 'J9s': 0.7,
            'T9s': 1.0, 'T8s': 0.5,
            '98s': 1.0, '97s': 0.4,
            '87s': 0.9, '76s': 0.7, '65s': 0.5, '54s': 0.4,
            'AKo': 0.7, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 0.6,
            'KQo': 1.0, 'KJo': 0.7, 'KTo': 0.4,
            'QJo': 0.7, 'JTo': 0.5,
        },
    },

    // =========================================================================
    // BTN vs BB 3-bet (BTN opens, BB 3-bets)
    // 4-bet: 8.8%, Call: 35.3%, Fold: 56%
    // =========================================================================
    'BTN_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.2,
            'AKs': 0.5, 'AKo': 0.3,
            'A5s': 0.3, 'A4s': 0.2,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.9, '66': 0.7, '55': 0.5,
            'AKs': 0.5, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.7, 'A8s': 0.5,
            'A5s': 0.7, 'A4s': 0.8, 'A3s': 0.6, 'A2s': 0.4,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 0.9, 'K9s': 0.5,
            'QJs': 1.0, 'QTs': 0.8, 'Q9s': 0.4,
            'JTs': 1.0, 'J9s': 0.6,
            'T9s': 0.9, 'T8s': 0.4,
            '98s': 0.8, '87s': 0.7, '76s': 0.5, '65s': 0.4,
            'AKo': 0.7, 'AQo': 1.0, 'AJo': 0.9, 'ATo': 0.5,
            'KQo': 0.9, 'KJo': 0.6,
        },
    },

    // =========================================================================
    // SB vs BB 3-bet (SB opens, BB 3-bets)
    // 4-bet: 18%, Call: 33.7%, Fold: 48.3%
    // =========================================================================
    'SB_vs_BB_3bet': {
        '4bet': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.7, 'JJ': 0.3,
            'AKs': 1.0, 'AKo': 1.0,
            'A5s': 0.8, 'A4s': 0.6, 'A3s': 0.4,
            'K5s': 0.3,
        },
        'call': {
            'QQ': 0.3, 'JJ': 0.7, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 1.0, '66': 0.9, '55': 0.7, '44': 0.5, '33': 0.3,
            'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 0.8, 'A8s': 0.6, 'A7s': 0.4, 'A6s': 0.3,
            'A5s': 0.2, 'A4s': 0.4, 'A3s': 0.6, 'A2s': 0.8,
            'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 0.7, 'K8s': 0.4,
            'K5s': 0.7, 'K4s': 0.5, 'K3s': 0.3,
            'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.6, 'Q8s': 0.3,
            'JTs': 1.0, 'J9s': 0.8, 'J8s': 0.4,
            'T9s': 1.0, 'T8s': 0.6,
            '98s': 0.9, '97s': 0.4,
            '87s': 0.8, '86s': 0.3,
            '76s': 0.7, '65s': 0.6, '54s': 0.5, '43s': 0.3,
            'AQo': 0.9, 'AJo': 0.8, 'ATo': 0.5,
            'KQo': 0.8, 'KJo': 0.5, 'KTo': 0.3,
            'QJo': 0.5, 'QTo': 0.3,
        },
    },
};

// =============================================================================
// VS 4-BET RANGES (When you 3-bet and face a 4-bet)
// Actions: All-in (5-bet shove), Call, or Fold
// =============================================================================

export const VS_FOUR_BET_RANGES_V2: Record<string, Record<string, Record<string, number>>> = {

    // =========================================================================
    // BB vs SB 4-bet (BB 3-bet, SB 4-bets)
    // All-in: 10.9%, Call: 56.3%, Fold: 32.8%
    // =========================================================================
    'BB_vs_SB_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.5,
            'AKs': 0.3,
            'A5s': 0.2,
        },
        'call': {
            'KK': 0.5, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 1.0, '77': 0.8, '66': 0.5,
            'AKs': 0.7, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.9, 'A9s': 0.6,
            'A5s': 0.8, 'A4s': 1.0, 'A3s': 0.8,
            'KQs': 1.0, 'KJs': 0.9, 'KTs': 0.6,
            'QJs': 0.8, 'QTs': 0.5,
            'JTs': 0.7, 'T9s': 0.5, '98s': 0.4,
            'AKo': 1.0, 'AQo': 0.9, 'AJo': 0.6,
            'KQo': 0.5,
        },
    },

    // =========================================================================
    // BB vs BTN 4-bet (BB 3-bet vs BTN open, BTN 4-bets)
    // All-in: 23.4%, Call: 43.9%, Fold: 32.7%
    // =========================================================================
    'BB_vs_BTN_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.9, 'QQ': 0.4,
            'AKs': 0.7, 'AKo': 0.5,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'KK': 0.1, 'QQ': 0.6, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.8, '77': 0.5,
            'AKs': 0.3, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.7,
            'A5s': 0.5, 'A4s': 0.7,
            'KQs': 1.0, 'KJs': 0.7,
            'QJs': 0.6, 'JTs': 0.5, 'T9s': 0.4,
            'AKo': 0.5, 'AQo': 0.8,
        },
    },

    // =========================================================================
    // BB vs CO 4-bet (BB 3-bet vs CO open, CO 4-bets)
    // All-in: 27.6%, Call: 30.1%, Fold: 42.3%
    // =========================================================================
    'BB_vs_CO_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.5,
            'AKs': 0.9, 'AKo': 0.7,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.5, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.5,
            'AKs': 0.1, 'AQs': 1.0, 'AJs': 0.8,
            'A5s': 0.4, 'A4s': 0.6,
            'KQs': 0.9, 'KJs': 0.5,
            'QJs': 0.4, 'JTs': 0.3,
            'AKo': 0.3, 'AQo': 0.7,
        },
    },

    // =========================================================================
    // BB vs HJ 4-bet (BB 3-bet vs HJ open, HJ 4-bets)
    // All-in: 32.3%, Call: 21.4%, Fold: 46.4%
    // =========================================================================
    'BB_vs_HJ_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'A5s': 0.7, 'A4s': 0.5,
        },
        'call': {
            'QQ': 0.3, 'JJ': 1.0, 'TT': 0.9, '99': 0.5,
            'AQs': 1.0, 'AJs': 0.6,
            'A5s': 0.3, 'A4s': 0.5,
            'KQs': 0.7,
            'AKo': 0.1, 'AQo': 0.5,
        },
    },

    // =========================================================================
    // BB vs UTG 4-bet (BB 3-bet vs UTG open, UTG 4-bets)
    // All-in: 31.2%, Call: 23.5%, Fold: 45.3%
    // =========================================================================
    'BB_vs_UTG_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6,
            'AKs': 1.0, 'AKo': 0.8,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.4, 'JJ': 1.0, 'TT': 0.9, '99': 0.6,
            'AQs': 1.0, 'AJs': 0.7,
            'A5s': 0.4, 'A4s': 0.6,
            'KQs': 0.8, 'KJs': 0.4,
            'AKo': 0.2, 'AQo': 0.6,
        },
    },

    // =========================================================================
    // SB vs UTG 4-bet (SB 3-bet vs UTG open, UTG 4-bets)
    // All-in: 31%, Call: 28.1%, Fold: 41%
    // =========================================================================
    'SB_vs_UTG_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.6,
            'AKs': 1.0, 'AKo': 0.8,
            'A5s': 0.6, 'A4s': 0.4,
        },
        'call': {
            'QQ': 0.4, 'JJ': 1.0, 'TT': 0.9, '99': 0.5,
            'AQs': 1.0, 'AJs': 0.7,
            'A5s': 0.4, 'A4s': 0.6,
            'KQs': 0.7, 'KJs': 0.4,
            'AKo': 0.2, 'AQo': 0.5,
        },
    },

    // =========================================================================
    // SB vs HJ 4-bet (SB 3-bet vs HJ open, HJ 4-bets)
    // All-in: 30.3%, Call: 27.7%, Fold: 42%
    // =========================================================================
    'SB_vs_HJ_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.5,
            'AKs': 1.0, 'AKo': 0.7,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.5, 'JJ': 1.0, 'TT': 0.9, '99': 0.5,
            'AQs': 1.0, 'AJs': 0.7,
            'A5s': 0.5, 'A4s': 0.7,
            'KQs': 0.7, 'KJs': 0.4,
            'AKo': 0.3, 'AQo': 0.5,
        },
    },

    // =========================================================================
    // SB vs CO 4-bet (SB 3-bet vs CO open, CO 4-bets)
    // All-in: 27.5%, Call: 34.1%, Fold: 38.4%
    // =========================================================================
    'SB_vs_CO_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.4,
            'AKs': 0.9, 'AKo': 0.6,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.6, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.4,
            'AKs': 0.1, 'AQs': 1.0, 'AJs': 0.9, 'ATs': 0.4,
            'A5s': 0.5, 'A4s': 0.7,
            'KQs': 1.0, 'KJs': 0.6,
            'QJs': 0.4, 'JTs': 0.3,
            'AKo': 0.4, 'AQo': 0.7, 'AJo': 0.3,
        },
    },

    // =========================================================================
    // SB vs BTN 4-bet (SB 3-bet vs BTN open, BTN 4-bets)
    // All-in: 21.4%, Call: 54.6%, Fold: 24%
    // =========================================================================
    'SB_vs_BTN_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.3,
            'AKs': 0.6, 'AKo': 0.4,
            'A5s': 0.3,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.9, '77': 0.6, '66': 0.3,
            'AKs': 0.4, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.8, 'A9s': 0.4,
            'A5s': 0.7, 'A4s': 1.0, 'A3s': 0.7, 'A2s': 0.4,
            'KQs': 1.0, 'KJs': 0.9, 'KTs': 0.6,
            'QJs': 0.8, 'QTs': 0.5,
            'JTs': 0.7, 'T9s': 0.5, '98s': 0.4,
            'AKo': 0.6, 'AQo': 1.0, 'AJo': 0.7,
            'KQo': 0.6,
        },
    },

    // =========================================================================
    // BTN vs UTG 4-bet (BTN 3-bet vs UTG open, UTG 4-bets)
    // All-in: 18.9%, Call: 38.7%, Fold: 42.4%
    // =========================================================================
    'BTN_vs_UTG_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.9, 'QQ': 0.3,
            'AKs': 0.7, 'AKo': 0.5,
            'A5s': 0.4,
        },
        'call': {
            'KK': 0.1, 'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.5,
            'AKs': 0.3, 'AQs': 1.0, 'AJs': 0.9, 'ATs': 0.5,
            'A5s': 0.6, 'A4s': 0.8,
            'KQs': 1.0, 'KJs': 0.6,
            'QJs': 0.5, 'JTs': 0.4,
            'AKo': 0.5, 'AQo': 0.8,
        },
    },

    // =========================================================================
    // BTN vs HJ 4-bet (BTN 3-bet vs HJ open, HJ 4-bets)
    // All-in: 17.3%, Call: 41%, Fold: 41.8%
    // =========================================================================
    'BTN_vs_HJ_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.9, 'QQ': 0.3,
            'AKs': 0.6, 'AKo': 0.4,
            'A5s': 0.3,
        },
        'call': {
            'KK': 0.1, 'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 0.9, '88': 0.6, '77': 0.3,
            'AKs': 0.4, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.6,
            'A5s': 0.7, 'A4s': 0.9,
            'KQs': 1.0, 'KJs': 0.7,
            'QJs': 0.6, 'JTs': 0.5, 'T9s': 0.3,
            'AKo': 0.6, 'AQo': 0.9, 'AJo': 0.4,
        },
    },

    // =========================================================================
    // BTN vs CO 4-bet (BTN 3-bet vs CO open, CO 4-bets)
    // All-in: 20%, Call: 36.8%, Fold: 43.2%
    // =========================================================================
    'BTN_vs_CO_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.4,
            'AKs': 0.8, 'AKo': 0.6,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.6, 'JJ': 1.0, 'TT': 1.0, '99': 0.8, '88': 0.5,
            'AKs': 0.2, 'AQs': 1.0, 'AJs': 0.9, 'ATs': 0.5,
            'A5s': 0.5, 'A4s': 0.7,
            'KQs': 1.0, 'KJs': 0.6,
            'QJs': 0.5, 'JTs': 0.4,
            'AKo': 0.4, 'AQo': 0.8,
        },
    },

    // =========================================================================
    // CO vs HJ 4-bet (CO 3-bet vs HJ open, HJ 4-bets)
    // All-in: 16.3%, Call: 46.5%, Fold: 37.3%
    // =========================================================================
    'CO_vs_HJ_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.8, 'QQ': 0.2,
            'AKs': 0.5, 'AKo': 0.3,
            'A5s': 0.3,
        },
        'call': {
            'KK': 0.2, 'QQ': 0.8, 'JJ': 1.0, 'TT': 1.0, '99': 1.0, '88': 0.8, '77': 0.5,
            'AKs': 0.5, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.7,
            'A5s': 0.7, 'A4s': 0.9,
            'KQs': 1.0, 'KJs': 0.8, 'KTs': 0.4,
            'QJs': 0.7, 'QTs': 0.4,
            'JTs': 0.6, 'T9s': 0.4, '98s': 0.3,
            'AKo': 0.7, 'AQo': 1.0, 'AJo': 0.6,
            'KQo': 0.5,
        },
    },

    // =========================================================================
    // CO vs UTG 4-bet (CO 3-bet vs UTG open, UTG 4-bets)
    // All-in: 18.9%, Call: 43%, Fold: 38%
    // =========================================================================
    'CO_vs_UTG_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 0.9, 'QQ': 0.3,
            'AKs': 0.7, 'AKo': 0.5,
            'A5s': 0.4,
        },
        'call': {
            'KK': 0.1, 'QQ': 0.7, 'JJ': 1.0, 'TT': 1.0, '99': 0.9, '88': 0.7, '77': 0.4,
            'AKs': 0.3, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.6,
            'A5s': 0.6, 'A4s': 0.8,
            'KQs': 1.0, 'KJs': 0.7, 'KTs': 0.3,
            'QJs': 0.6, 'QTs': 0.3,
            'JTs': 0.5, 'T9s': 0.3,
            'AKo': 0.5, 'AQo': 0.9, 'AJo': 0.5,
            'KQo': 0.4,
        },
    },

    // =========================================================================
    // HJ vs UTG 4-bet (HJ 3-bet vs UTG open, UTG 4-bets)
    // All-in: 20.1%, Call: 41%, Fold: 38.9%
    // =========================================================================
    'HJ_vs_UTG_4bet': {
        'allin': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.4,
            'AKs': 0.8, 'AKo': 0.6,
            'A5s': 0.5, 'A4s': 0.3,
        },
        'call': {
            'QQ': 0.6, 'JJ': 1.0, 'TT': 1.0, '99': 0.9, '88': 0.6, '77': 0.3,
            'AKs': 0.2, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 0.6,
            'A5s': 0.5, 'A4s': 0.7,
            'KQs': 1.0, 'KJs': 0.7, 'KTs': 0.3,
            'QJs': 0.6, 'JTs': 0.4,
            'AKo': 0.4, 'AQo': 0.9, 'AJo': 0.4,
            'KQo': 0.4,
        },
    },
};

// Add V1-compatible key aliases for VS_FOUR_BET_RANGES (V1 uses "heroPos_3bet_vs_villainPos_4bet")
// BB 3-bet spots
VS_FOUR_BET_RANGES_V2['BB_3bet_vs_SB_4bet'] = VS_FOUR_BET_RANGES_V2['BB_vs_SB_4bet'];
VS_FOUR_BET_RANGES_V2['BB_3bet_vs_BTN_4bet'] = VS_FOUR_BET_RANGES_V2['BB_vs_BTN_4bet'];
VS_FOUR_BET_RANGES_V2['BB_3bet_vs_CO_4bet'] = VS_FOUR_BET_RANGES_V2['BB_vs_CO_4bet'];
VS_FOUR_BET_RANGES_V2['BB_3bet_vs_HJ_4bet'] = VS_FOUR_BET_RANGES_V2['BB_vs_HJ_4bet'];
VS_FOUR_BET_RANGES_V2['BB_3bet_vs_UTG_4bet'] = VS_FOUR_BET_RANGES_V2['BB_vs_UTG_4bet'];
// SB 3-bet spots
VS_FOUR_BET_RANGES_V2['SB_3bet_vs_UTG_4bet'] = VS_FOUR_BET_RANGES_V2['SB_vs_UTG_4bet'];
VS_FOUR_BET_RANGES_V2['SB_3bet_vs_HJ_4bet'] = VS_FOUR_BET_RANGES_V2['SB_vs_HJ_4bet'];
VS_FOUR_BET_RANGES_V2['SB_3bet_vs_CO_4bet'] = VS_FOUR_BET_RANGES_V2['SB_vs_CO_4bet'];
VS_FOUR_BET_RANGES_V2['SB_3bet_vs_BTN_4bet'] = VS_FOUR_BET_RANGES_V2['SB_vs_BTN_4bet'];
// BTN 3-bet spots
VS_FOUR_BET_RANGES_V2['BTN_3bet_vs_UTG_4bet'] = VS_FOUR_BET_RANGES_V2['BTN_vs_UTG_4bet'];
VS_FOUR_BET_RANGES_V2['BTN_3bet_vs_HJ_4bet'] = VS_FOUR_BET_RANGES_V2['BTN_vs_HJ_4bet'];
VS_FOUR_BET_RANGES_V2['BTN_3bet_vs_CO_4bet'] = VS_FOUR_BET_RANGES_V2['BTN_vs_CO_4bet'];
// CO 3-bet spots
VS_FOUR_BET_RANGES_V2['CO_3bet_vs_UTG_4bet'] = VS_FOUR_BET_RANGES_V2['CO_vs_UTG_4bet'];
VS_FOUR_BET_RANGES_V2['CO_3bet_vs_HJ_4bet'] = VS_FOUR_BET_RANGES_V2['CO_vs_HJ_4bet'];
// HJ 3-bet spots
VS_FOUR_BET_RANGES_V2['HJ_3bet_vs_UTG_4bet'] = VS_FOUR_BET_RANGES_V2['HJ_vs_UTG_4bet'];

// =============================================================================
// VS 5-BET RANGES (When you 4-bet and face a 5-bet all-in)
// Actions: Call or Fold (opponent already all-in)
// =============================================================================

export const VS_FIVE_BET_RANGES_V2: Record<string, Record<string, Record<string, number>>> = {

    // =========================================================================
    // UTG vs HJ 5-bet (UTG opens, HJ 3-bets, UTG 4-bets, HJ shoves)
    // Call: 64.9%, Fold: 35.1%
    // =========================================================================
    'UTG_vs_HJ_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.7,
            'A5s': 0.5, 'A4s': 0.6,
        },
    },

    // =========================================================================
    // UTG vs CO 5-bet (UTG opens, CO 3-bets, UTG 4-bets, CO shoves)
    // Call: 66.6%, Fold: 33.4%
    // =========================================================================
    'UTG_vs_CO_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.9,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.8,
            'A5s': 0.6, 'A4s': 0.7,
        },
    },

    // =========================================================================
    // UTG vs BTN 5-bet (UTG opens, BTN 3-bets, UTG 4-bets, BTN shoves)
    // Call: 61.8%, Fold: 38.2%
    // =========================================================================
    'UTG_vs_BTN_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'AQs': 0.6,
            'A5s': 0.4, 'A4s': 0.5,
        },
    },

    // =========================================================================
    // UTG vs SB 5-bet (UTG opens, SB 3-bets, UTG 4-bets, SB shoves)
    // Call: 64.8%, Fold: 35.2%
    // =========================================================================
    'UTG_vs_SB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.7,
            'A5s': 0.5, 'A4s': 0.6,
        },
    },

    // =========================================================================
    // UTG vs BB 5-bet (UTG opens, BB 3-bets, UTG 4-bets, BB shoves)
    // Call: 64.3%, Fold: 35.7%
    // =========================================================================
    'UTG_vs_BB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.7,
            'A5s': 0.5, 'A4s': 0.6,
        },
    },

    // =========================================================================
    // HJ vs CO 5-bet (HJ opens, CO 3-bets, HJ 4-bets, CO shoves)
    // Call: 64.7%, Fold: 35.3%
    // =========================================================================
    'HJ_vs_CO_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.7,
            'A5s': 0.5, 'A4s': 0.6,
        },
    },

    // =========================================================================
    // HJ vs BTN 5-bet (HJ opens, BTN 3-bets, HJ 4-bets, BTN shoves)
    // Call: 61.6%, Fold: 38.4%
    // =========================================================================
    'HJ_vs_BTN_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'AQs': 0.6,
            'A5s': 0.4, 'A4s': 0.5,
        },
    },

    // =========================================================================
    // HJ vs SB 5-bet (HJ opens, SB 3-bets, HJ 4-bets, SB shoves)
    // Call: 61.7%, Fold: 38.3%
    // =========================================================================
    'HJ_vs_SB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'AQs': 0.6,
            'A5s': 0.4, 'A4s': 0.5,
        },
    },

    // =========================================================================
    // HJ vs BB 5-bet (HJ opens, BB 3-bets, HJ 4-bets, BB shoves)
    // Call: 66.5%, Fold: 33.5%
    // =========================================================================
    'HJ_vs_BB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.9,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.8,
            'A5s': 0.6, 'A4s': 0.7,
        },
    },

    // =========================================================================
    // CO vs BTN 5-bet (CO opens, BTN 3-bets, CO 4-bets, BTN shoves)
    // Call: 57.4%, Fold: 42.6%
    // =========================================================================
    'CO_vs_BTN_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.9, 'JJ': 0.5,
            'AKs': 1.0, 'AKo': 0.8,
            'AQs': 0.5,
            'A5s': 0.3, 'A4s': 0.4,
        },
    },

    // =========================================================================
    // CO vs SB 5-bet (CO opens, SB 3-bets, CO 4-bets, SB shoves)
    // Call: 62.3%, Fold: 37.7%
    // =========================================================================
    'CO_vs_SB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'AQs': 0.6,
            'A5s': 0.4, 'A4s': 0.5,
        },
    },

    // =========================================================================
    // CO vs BB 5-bet (CO opens, BB 3-bets, CO 4-bets, BB shoves)
    // Call: 65.6%, Fold: 34.4%
    // =========================================================================
    'CO_vs_BB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.8,
            'AKs': 1.0, 'AKo': 1.0,
            'AQs': 0.7,
            'A5s': 0.5, 'A4s': 0.6,
        },
    },

    // =========================================================================
    // BTN vs SB 5-bet (BTN opens, SB 3-bets, BTN 4-bets, SB shoves)
    // Call: 57.4%, Fold: 42.6%
    // =========================================================================
    'BTN_vs_SB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.9, 'JJ': 0.5,
            'AKs': 1.0, 'AKo': 0.8,
            'AQs': 0.5,
            'A5s': 0.3, 'A4s': 0.4,
        },
    },

    // =========================================================================
    // BTN vs BB 5-bet (BTN opens, BB 3-bets, BTN 4-bets, BB shoves)
    // Call: 62.6%, Fold: 37.4%
    // =========================================================================
    'BTN_vs_BB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 0.7,
            'AKs': 1.0, 'AKo': 0.9,
            'AQs': 0.6,
            'A5s': 0.4, 'A4s': 0.5,
        },
    },

    // =========================================================================
    // SB vs BB 5-bet (SB opens, BB 3-bets, SB 4-bets, BB shoves)
    // Call: 51%, Fold: 49%
    // =========================================================================
    'SB_vs_BB_5bet': {
        'call': {
            'AA': 1.0, 'KK': 1.0, 'QQ': 0.7, 'JJ': 0.3,
            'AKs': 0.9, 'AKo': 0.6,
            'AQs': 0.3,
            'A5s': 0.2, 'A4s': 0.2,
        },
    },
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

    // =========================================================================
    // SB Facing Raise Stats (3-bet or Fold - SB has no calling range)
    // =========================================================================
    'SB_vs_UTG': { raise: 0.068, call: 0, fold: 0.932, raiseSize: '13bb' },
    'SB_vs_HJ': { raise: 0.080, call: 0, fold: 0.920, raiseSize: '13bb' },
    'SB_vs_CO': { raise: 0.101, call: 0, fold: 0.899, raiseSize: '13bb' },
    'SB_vs_BTN': { raise: 0.143, call: 0, fold: 0.857, raiseSize: '12bb' },

    // =========================================================================
    // HJ/CO Facing Raise Stats (3-bet or Fold)
    // =========================================================================
    'HJ_vs_UTG': { raise: 0.072, call: 0, fold: 0.928, raiseSize: '9.5bb' },
    'CO_vs_UTG': { raise: 0.076, call: 0, fold: 0.924, raiseSize: '9.5bb' },
    'CO_vs_HJ': { raise: 0.088, call: 0, fold: 0.912, raiseSize: '9.5bb' },

    // =========================================================================
    // BTN Facing Raise Stats (3-bet, Call, or Fold)
    // =========================================================================
    'BTN_vs_UTG': { raise: 0.055, call: 0.100, fold: 0.846, raiseSize: '10bb' },
    'BTN_vs_HJ': { raise: 0.065, call: 0.104, fold: 0.830, raiseSize: '10bb' },
    'BTN_vs_CO': { raise: 0.084, call: 0.110, fold: 0.807, raiseSize: '10bb' },

    // =========================================================================
    // UTG Facing 3-Bet Stats (4-bet, Call, or Fold)
    // =========================================================================
    'UTG_vs_HJ_3bet': { raise: 0.201, call: 0.211, fold: 0.588, raiseSize: '24bb' },
    'UTG_vs_CO_3bet': { raise: 0.221, call: 0.198, fold: 0.581, raiseSize: '24bb' },
    'UTG_vs_BTN_3bet': { raise: 0.180, call: 0.305, fold: 0.515, raiseSize: '25bb' },
    'UTG_vs_SB_3bet': { raise: 0.105, call: 0.322, fold: 0.573, raiseSize: '27.5bb' },
    'UTG_vs_BB_3bet': { raise: 0.075, call: 0.356, fold: 0.569, raiseSize: '29.5bb' },

    // =========================================================================
    // HJ Facing 3-Bet Stats (4-bet, Call, or Fold)
    // =========================================================================
    'HJ_vs_CO_3bet': { raise: 0.207, call: 0.207, fold: 0.586, raiseSize: '24bb' },
    'HJ_vs_BTN_3bet': { raise: 0.179, call: 0.291, fold: 0.530, raiseSize: '25bb' },
    'HJ_vs_SB_3bet': { raise: 0.100, call: 0.326, fold: 0.574, raiseSize: '27.5bb' },
    'HJ_vs_BB_3bet': { raise: 0.074, call: 0.358, fold: 0.569, raiseSize: '29.5bb' },

    // =========================================================================
    // CO Facing 3-Bet Stats (4-bet, Call, or Fold)
    // =========================================================================
    'CO_vs_BTN_3bet': { raise: 0.175, call: 0.278, fold: 0.547, raiseSize: '25bb' },
    'CO_vs_SB_3bet': { raise: 0.105, call: 0.306, fold: 0.589, raiseSize: '27.5bb' },
    'CO_vs_BB_3bet': { raise: 0.084, call: 0.334, fold: 0.582, raiseSize: '29.5bb' },

    // =========================================================================
    // BTN Facing 3-Bet Stats (4-bet, Call, or Fold)
    // =========================================================================
    'BTN_vs_SB_3bet': { raise: 0.089, call: 0.407, fold: 0.504, raiseSize: '25bb' },
    'BTN_vs_BB_3bet': { raise: 0.088, call: 0.353, fold: 0.560, raiseSize: '28.5bb' },

    // =========================================================================
    // SB Facing 3-Bet Stats (4-bet, Call, or Fold)
    // =========================================================================
    'SB_vs_BB_3bet': { raise: 0.180, call: 0.337, fold: 0.483, raiseSize: '23bb' },

    // =========================================================================
    // BB Facing 4-Bet Stats (All-in, Call, or Fold)
    // =========================================================================
    'BB_vs_SB_4bet': { raise: 0.109, call: 0.563, fold: 0.328, raiseSize: '100bb' },
    'BB_vs_BTN_4bet': { raise: 0.234, call: 0.439, fold: 0.327, raiseSize: '100bb' },
    'BB_vs_CO_4bet': { raise: 0.276, call: 0.301, fold: 0.423, raiseSize: '100bb' },
    'BB_vs_HJ_4bet': { raise: 0.323, call: 0.214, fold: 0.464, raiseSize: '100bb' },
    'BB_vs_UTG_4bet': { raise: 0.312, call: 0.235, fold: 0.453, raiseSize: '100bb' },

    // =========================================================================
    // SB Facing 4-Bet Stats (All-in, Call, or Fold)
    // =========================================================================
    'SB_vs_UTG_4bet': { raise: 0.310, call: 0.281, fold: 0.410, raiseSize: '100bb' },
    'SB_vs_HJ_4bet': { raise: 0.303, call: 0.277, fold: 0.420, raiseSize: '100bb' },
    'SB_vs_CO_4bet': { raise: 0.275, call: 0.341, fold: 0.384, raiseSize: '100bb' },
    'SB_vs_BTN_4bet': { raise: 0.214, call: 0.546, fold: 0.240, raiseSize: '100bb' },

    // =========================================================================
    // BTN Facing 4-Bet Stats (All-in, Call, or Fold)
    // =========================================================================
    'BTN_vs_UTG_4bet': { raise: 0.189, call: 0.387, fold: 0.424, raiseSize: '100bb' },
    'BTN_vs_HJ_4bet': { raise: 0.173, call: 0.410, fold: 0.418, raiseSize: '100bb' },
    'BTN_vs_CO_4bet': { raise: 0.200, call: 0.368, fold: 0.432, raiseSize: '100bb' },

    // =========================================================================
    // CO Facing 4-Bet Stats (All-in, Call, or Fold)
    // =========================================================================
    'CO_vs_HJ_4bet': { raise: 0.163, call: 0.465, fold: 0.373, raiseSize: '100bb' },
    'CO_vs_UTG_4bet': { raise: 0.189, call: 0.430, fold: 0.380, raiseSize: '100bb' },

    // =========================================================================
    // HJ Facing 4-Bet Stats (All-in, Call, or Fold)
    // =========================================================================
    'HJ_vs_UTG_4bet': { raise: 0.201, call: 0.410, fold: 0.389, raiseSize: '100bb' },

    // =========================================================================
    // UTG Facing 5-Bet Stats (Call or Fold - opponent all-in)
    // =========================================================================
    'UTG_vs_HJ_5bet': { raise: 0, call: 0.649, fold: 0.351, raiseSize: 'N/A' },
    'UTG_vs_CO_5bet': { raise: 0, call: 0.666, fold: 0.334, raiseSize: 'N/A' },
    'UTG_vs_BTN_5bet': { raise: 0, call: 0.618, fold: 0.382, raiseSize: 'N/A' },
    'UTG_vs_SB_5bet': { raise: 0, call: 0.648, fold: 0.352, raiseSize: 'N/A' },
    'UTG_vs_BB_5bet': { raise: 0, call: 0.643, fold: 0.357, raiseSize: 'N/A' },

    // =========================================================================
    // HJ Facing 5-Bet Stats (Call or Fold - opponent all-in)
    // =========================================================================
    'HJ_vs_CO_5bet': { raise: 0, call: 0.647, fold: 0.353, raiseSize: 'N/A' },
    'HJ_vs_BTN_5bet': { raise: 0, call: 0.616, fold: 0.384, raiseSize: 'N/A' },
    'HJ_vs_SB_5bet': { raise: 0, call: 0.617, fold: 0.383, raiseSize: 'N/A' },
    'HJ_vs_BB_5bet': { raise: 0, call: 0.665, fold: 0.335, raiseSize: 'N/A' },

    // =========================================================================
    // CO Facing 5-Bet Stats (Call or Fold - opponent all-in)
    // =========================================================================
    'CO_vs_BTN_5bet': { raise: 0, call: 0.574, fold: 0.426, raiseSize: 'N/A' },
    'CO_vs_SB_5bet': { raise: 0, call: 0.623, fold: 0.377, raiseSize: 'N/A' },
    'CO_vs_BB_5bet': { raise: 0, call: 0.656, fold: 0.344, raiseSize: 'N/A' },

    // =========================================================================
    // BTN Facing 5-Bet Stats (Call or Fold - opponent all-in)
    // =========================================================================
    'BTN_vs_SB_5bet': { raise: 0, call: 0.574, fold: 0.426, raiseSize: 'N/A' },
    'BTN_vs_BB_5bet': { raise: 0, call: 0.626, fold: 0.374, raiseSize: 'N/A' },

    // =========================================================================
    // SB Facing 5-Bet Stats (Call or Fold - opponent all-in)
    // =========================================================================
    'SB_vs_BB_5bet': { raise: 0, call: 0.510, fold: 0.490, raiseSize: 'N/A' },
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

/**
 * Calculate ABSOLUTE frequency of a hand reaching a decision point.
 * 
 * Compounds all frequencies through the action chain.
 * 
 * @example
 * // QQ in BB 3-betting UTG, then facing 4-bet:
 * getAbsoluteFrequency('QQ', [
 *   { scenario: 'BB_vs_UTG', action: '3bet' },    // 50% 3-bet
 *   { scenario: 'BB_vs_UTG_4bet', action: 'call' } // 30% call the 4-bet
 * ]);
 * // Returns 0.15 (15% of QQ combos reach this point)
 */
export function getAbsoluteFrequency(
    hand: string,
    actionChain: { scenario: string; action: string }[]
): number {
    const normalized = normalizeHand(hand);
    let compoundFreq = 1.0;

    for (const step of actionChain) {
        let freq = 0;

        // Check which range type to use based on scenario pattern
        if (step.scenario.startsWith('RFI_')) {
            // RFI scenario
            const pos = step.scenario.replace('RFI_', '');
            freq = RFI_RANGES_V2[pos]?.[normalized] || 0;
        } else if (step.scenario.includes('_5bet')) {
            // VS 5-bet scenario
            freq = VS_FIVE_BET_RANGES_V2[step.scenario]?.[step.action]?.[normalized] || 0;
        } else if (step.scenario.includes('_4bet')) {
            // VS 4-bet scenario
            freq = VS_FOUR_BET_RANGES_V2[step.scenario]?.[step.action]?.[normalized] || 0;
        } else if (step.scenario.includes('_3bet')) {
            // VS 3-bet scenario
            freq = VS_THREE_BET_RANGES_V2[step.scenario]?.[step.action]?.[normalized] || 0;
        } else {
            // Facing open (3-bet/call scenario)
            freq = THREE_BET_RANGES_V2[step.scenario]?.[step.action]?.[normalized] || 0;
        }

        compoundFreq *= freq;

        // Early exit if frequency hit 0
        if (compoundFreq === 0) break;
    }

    return compoundFreq;
}

/**
 * Check if a hand made it through the previous action's range.
 * 
 * For multi-step scenarios (e.g., facing 4-bet), validates that
 * the hand was in the prior range before checking current action.
 * 
 * @example
 * isHandInRange('QQ', 'BB_vs_UTG_4bet');
 * // Returns true if QQ is in BB's 3-bet range vs UTG
 */
export function isHandInRange(hand: string, scenario: string): boolean {
    const normalized = normalizeHand(hand);

    // Determine the previous range based on scenario pattern
    if (scenario.includes('_5bet')) {
        // To face 5-bet, hand must have been in 4-bet range
        // Pattern: HERO_vs_VILLAIN_5bet → VILLAIN_vs_HERO_4bet (villain 4-bet us)
        // For now, just check if hand has any frequency in the 5-bet scenario
        const rangeData = VS_FIVE_BET_RANGES_V2[scenario];
        if (!rangeData) return false;
        const callFreq = rangeData['call']?.[normalized] || 0;
        return callFreq > 0;
    } else if (scenario.includes('_4bet')) {
        // To face 4-bet, hand must have been in 3-bet range
        // Extract positions: 'BB_vs_UTG_4bet' → check BB 3-bet vs UTG
        const match = scenario.match(/^(\w+)_vs_(\w+)_4bet$/);
        if (!match) return false;
        const [, hero, villain] = match;
        const threeBetKey = `${hero}_vs_${villain}`;
        const rangeData = THREE_BET_RANGES_V2[threeBetKey];
        if (!rangeData) return false;
        const threeBetFreq = rangeData['3bet']?.[normalized] || 0;
        return threeBetFreq > 0;
    } else if (scenario.includes('_3bet')) {
        // To face 3-bet, hand must have been in opening range
        // Extract opener: 'UTG_vs_BB_3bet' → check UTG RFI
        const match = scenario.match(/^(\w+)_vs_(\w+)_3bet$/);
        if (!match) return false;
        const [, opener] = match;
        const rfiFreq = RFI_RANGES_V2[opener]?.[normalized] || 0;
        return rfiFreq > 0;
    } else {
        // Simple facing open scenario - check if hand has any action
        const rangeData = THREE_BET_RANGES_V2[scenario];
        if (!rangeData) return false;
        const threeBetFreq = rangeData['3bet']?.[normalized] || 0;
        const callFreq = rangeData['call']?.[normalized] || 0;
        return threeBetFreq > 0 || callFreq > 0;
    }
}

/**
 * Get all aggregate stats for a spot (fold/call/raise percentages)
 * Useful for complete EV analysis in agents
 */
export function getAllSpotStats(spot: string): SpotStats | null {
    return SPOT_AGGREGATE_STATS[spot] || null;
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
 * Get 3-bet or call action when facing an open (simplified version)
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
// AGENT-COMPATIBLE LOOKUP FUNCTIONS (Match gtoRanges.ts interface)
// =============================================================================

/**
 * Get the opening action for a hand from a specific position
 * Returns RangeResult for compatibility with agent code
 */
export function getOpeningAction(hand: string, position: string): RangeResult {
    const normalized = normalizeHand(hand);
    const posKey = normalizePosition(position);

    const range = RFI_RANGES_V2[posKey];
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
        const sizing = posKey === 'SB' ? '3.5bb' : '3bb'; // V2 uses 3bb standard
        return {
            found: true,
            action: { action: 'raise', frequency, sizing },
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
 * Returns RangeResult for compatibility with agent code
 */
export function getFacingOpenAction(
    hand: string,
    heroPosition: string,
    openerPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const heroPos = normalizePosition(heroPosition);
    const openerPos = normalizePosition(openerPosition);
    const key = `${heroPos}_vs_${openerPos}`;

    const rangeData = THREE_BET_RANGES_V2[key];

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
        const stats = SPOT_AGGREGATE_STATS[key];
        const sizing = stats?.raiseSize || '10bb';
        return {
            found: true,
            action: { action: '3bet', frequency: threeBetFreq, sizing },
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
        if (threeBetFreq > callFreq) {
            const stats = SPOT_AGGREGATE_STATS[key];
            const sizing = stats?.raiseSize || '10bb';
            return {
                found: true,
                action: { action: '3bet', frequency: threeBetFreq, sizing },
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
 * Get action when CONSIDERING calling an open raise (Cold Call)
 * Uses the 'call' portion of THREE_BET_RANGES_V2
 */
export function getColdCallAction(
    hand: string,
    heroPosition: string,
    openerPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const key = `${normalizePosition(heroPosition)}_vs_${normalizePosition(openerPosition)}`;
    const rangeData = THREE_BET_RANGES_V2[key];

    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    const callFreq = rangeData['call']?.[normalized] || 0;

    if (callFreq > 0) {
        return {
            found: true,
            action: { action: 'call', frequency: callFreq },
            scenario: key,
            source: 'range_table',
        };
    }

    return {
        found: true,
        action: { action: 'fold', frequency: 1.0 },
        scenario: key,
        source: 'range_table',
    };
}

/**
 * Get action when CONSIDERING making a 3-bet (Hero vs Opener)
 * Returns the 3-bet frequency specifically for Range Building.
 */
export function getMaking3BetAction(
    hand: string,
    heroPosition: string,
    openerPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const key = `${normalizePosition(heroPosition)}_vs_${normalizePosition(openerPosition)}`;
    const rangeData = THREE_BET_RANGES_V2[key];

    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    const threeBetFreq = rangeData['3bet']?.[normalized] || 0;

    if (threeBetFreq > 0) {
        return {
            found: true,
            action: { action: '3bet', frequency: threeBetFreq },
            scenario: key,
            source: 'range_table',
        };
    }

    return {
        found: true,
        action: { action: 'fold', frequency: 1.0 },
        scenario: key,
        source: 'range_table',
    };
}

/**
 * Get action when facing a 3bet (after opening)
 * Uses VS_THREE_BET_RANGES_V2
 */
export function getVs3BetAction(
    hand: string,
    heroPosition: string,
    threeBettorPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const heroPos = normalizePosition(heroPosition);
    const threeBettorPos = normalizePosition(threeBettorPosition);
    const key = `${heroPos}_vs_${threeBettorPos}_3bet`;

    const rangeData = VS_THREE_BET_RANGES_V2[key];

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
        const stats = SPOT_AGGREGATE_STATS[key];
        const sizing = stats?.raiseSize || '22bb';
        return {
            found: true,
            action: { action: '4bet', frequency: fourBetFreq, sizing },
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
            const stats = SPOT_AGGREGATE_STATS[key];
            const sizing = stats?.raiseSize || '22bb';
            return {
                found: true,
                action: { action: '4bet', frequency: fourBetFreq, sizing },
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
 * Get action when facing a 4bet (after you 3-bet)
 * Uses VS_FOUR_BET_RANGES_V2
 */
export function getVs4BetAction(
    hand: string,
    heroPosition: string,
    fourBettorPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const heroPos = normalizePosition(heroPosition);
    const fourBettorPos = normalizePosition(fourBettorPosition);
    // V1-compatible key pattern: heroPos_3bet_vs_fourBettorPos_4bet
    const v1Key = `${heroPos}_3bet_vs_${fourBettorPos}_4bet`;
    // V2 key pattern: heroPos_vs_fourBettorPos_4bet
    const v2Key = `${heroPos}_vs_${fourBettorPos}_4bet`;
    // Try V1 pattern first (for agent compatibility), then V2
    const rangeData = VS_FOUR_BET_RANGES_V2[v1Key] || VS_FOUR_BET_RANGES_V2[v2Key];
    const key = VS_FOUR_BET_RANGES_V2[v1Key] ? v1Key : v2Key;
    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    // Check all-in/5bet shove range
    const shoveFreq = rangeData['allin']?.[normalized] || 0;
    if (shoveFreq >= 0.5) {
        return {
            found: true,
            action: { action: '5bet', frequency: shoveFreq, sizing: 'all-in' },
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
    if (shoveFreq > 0 || callFreq > 0) {
        if (shoveFreq > callFreq) {
            return {
                found: true,
                action: { action: '5bet', frequency: shoveFreq, sizing: 'all-in' },
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
 * Get action when facing a 5bet all-in (after you 4-bet)
 * Uses VS_FIVE_BET_RANGES_V2 (V2 only - not in original gtoRanges.ts)
 */
export function getVs5BetAction(
    hand: string,
    heroPosition: string,
    fiveBettorPosition: string
): RangeResult {
    const normalized = normalizeHand(hand);
    const heroPos = normalizePosition(heroPosition);
    const fiveBettorPos = normalizePosition(fiveBettorPosition);
    const key = `${heroPos}_vs_${fiveBettorPos}_5bet`;

    const rangeData = VS_FIVE_BET_RANGES_V2[key];
    if (!rangeData) {
        return {
            found: false,
            action: { action: 'fold', frequency: 1.0 },
            scenario: key,
            source: 'llm_fallback',
        };
    }

    // Only call or fold at this point (opponent is all-in)
    const callFreq = rangeData['call']?.[normalized] || 0;
    if (callFreq > 0) {
        return {
            found: true,
            action: { action: 'call', frequency: callFreq },
            scenario: key,
            source: 'range_table',
        };
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
 * Compatible with original gtoRanges.ts interface
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

    // Facing action (Open)
    if (villainContext.type === 'facing_action' && villainContext.villain) {
        return getFacingOpenAction(hand, heroPosition, villainContext.villain);
    }

    // Facing 3-Bet
    if (villainContext.type === 'vs_3bet' && villainContext.villain) {
        return getVs3BetAction(hand, heroPosition, villainContext.villain);
    }

    // Facing 4-Bet
    if (villainContext.type === 'vs_4bet' && villainContext.villain) {
        return getVs4BetAction(hand, heroPosition, villainContext.villain);
    }

    // Facing 5-Bet (V2 only)
    if (villainContext.type === 'vs_5bet' && villainContext.villain) {
        return getVs5BetAction(hand, heroPosition, villainContext.villain);
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
    return RFI_RANGES_V2[posKey]?.[normalized] || 0;
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
    // Range constants (aliased to match original names)
    RFI_RANGES: RFI_RANGES_V2,
    THREE_BET_RANGES: THREE_BET_RANGES_V2,
    VS_THREE_BET_RANGES: VS_THREE_BET_RANGES_V2,
    VS_FOUR_BET_RANGES: VS_FOUR_BET_RANGES_V2,
    VS_FIVE_BET_RANGES: VS_FIVE_BET_RANGES_V2,
    SPOT_AGGREGATE_STATS,

    // V2-specific helper functions
    getRFIAction,
    shouldRFI,
    getFacingRaiseAction,
    getSpotStats,
    isBluffProfitable,

    // Agent-compatible functions (match gtoRanges.ts interface)
    getOpeningAction,
    getFacingOpenAction,
    getColdCallAction,
    getMaking3BetAction,
    getVs3BetAction,
    getVs4BetAction,
    getVs5BetAction,
    getPreflopAction,
    isInOpeningRange,
    getOpeningFrequency,

    // Normalization utilities
    normalizeHand,
    normalizePosition,
};

// =============================================================================
// V1-COMPATIBLE NAMED EXPORTS (for UI pages that use named imports)
// =============================================================================
export const RFI_RANGES = RFI_RANGES_V2;
export const THREE_BET_RANGES = THREE_BET_RANGES_V2;
export const VS_THREE_BET_RANGES = VS_THREE_BET_RANGES_V2;
export const VS_FOUR_BET_RANGES = VS_FOUR_BET_RANGES_V2;
export const VS_FIVE_BET_RANGES = VS_FIVE_BET_RANGES_V2;
