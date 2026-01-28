
/**
 * Preflop Reasoning Engine
 * 
 * Provides educational "Why" explanations for GTO preflop decisions.
 * Classifies hands into categories (e.g. "Weak Offsuit Ace") and applies
 * poker theory principles to explain Folds, Calls, and Raises.
 */

import { normalizeHand } from './gtoRangesV2';
import { getHandType } from './handUtils';

// =============================================================================
// HAND CLASSIFICATION
// =============================================================================

export type PreflopCategory =
    | 'Premium Pair' | 'Strong Pair' | 'Medium Pair' | 'Low Pair'
    | 'Premium Ace' | 'Strong Ace' | 'Weak Ace' | 'Weak Offsuit Ace'
    | 'Premium Broadway' | 'Strong Broadway' | 'Offsuit Broadway'
    | 'Suited Connector' | 'Suited Gapper' | 'Offsuit Connector'
    | 'Suited Trash' | 'Offsuit Trash';

export function classifyPreflopHand(hand: string): PreflopCategory {
    const norm = normalizeHand(hand); // e.g. "AKs"

    // 1. Pairs
    if (norm.length === 2 && norm[0] === norm[1]) {
        const rank = norm[0];
        if (['A', 'K', 'Q'].includes(rank)) return 'Premium Pair';
        if (['J', 'T', '9'].includes(rank)) return 'Strong Pair';
        if (['8', '7', '6'].includes(rank)) return 'Medium Pair';
        return 'Low Pair'; // 55-22
    }

    // 2. Non-Pairs
    const rank1 = norm[0];
    const rank2 = norm[1];
    const suited = norm.includes('s');

    // Aces
    if (rank1 === 'A') {
        if (rank2 === 'K' || rank2 === 'Q') return 'Premium Ace'; // AK, AQ
        if (['J', 'T'].includes(rank2)) return 'Strong Ace'; // AJ, AT
        if (['9', '8', '7', '6'].includes(rank2)) return suited ? 'Weak Ace' : 'Weak Offsuit Ace';
        return suited ? 'Weak Ace' : 'Weak Offsuit Ace'; // A5-A2
    }

    // Kings
    if (rank1 === 'K') {
        if (['Q', 'J'].includes(rank2)) return suited ? 'Premium Broadway' : 'Offsuit Broadway';
        if (rank2 === 'T') return suited ? 'Strong Broadway' : 'Offsuit Broadway';
        return suited ? 'Suited Trash' : 'Offsuit Trash'; // K9 and below (simplified)
    }

    // Queens
    if (rank1 === 'Q') {
        if (['J', 'T'].includes(rank2)) return suited ? 'Strong Broadway' : 'Offsuit Broadway';
        return suited ? 'Suited Trash' : 'Offsuit Trash';
    }

    // Jacks/Tens
    if (rank1 === 'J' || rank1 === 'T') {
        if (['T', '9', '8', '7'].includes(rank2)) { // Connectedness check needed?
            // Simple heuristic: JTs, T9s are Suited Connectors
            return suited ? 'Suited Connector' : 'Offsuit Connector';
        }
    }

    // Connectors (Generic check)
    // We would need rank values. Let's do a simple check for Suited Connectors
    if (suited && ['98s', '87s', '76s', '65s', '54s'].includes(norm)) return 'Suited Connector';
    if (suited && ['J9s', 'T8s', '97s', '86s'].includes(norm)) return 'Suited Gapper';

    return suited ? 'Suited Trash' : 'Offsuit Trash';
}

// =============================================================================
// REASONING GENERATION
// =============================================================================

export function generatePreflopReasoning(
    hand: string,
    action: 'fold' | 'call' | 'raise' | '3bet' | '4bet' | '5bet',
    heroPos: string,
    villainPos: string, // The aggressor (if facing action)
    frequency: number
): string {
    const category = classifyPreflopHand(hand);
    const norm = normalizeHand(hand);
    const pct = (frequency * 100).toFixed(0);

    // BASE STRING
    const actionStr = action === 'fold' ? 'Fold'
        : action === 'call' ? 'Call'
            : action === 'raise' ? 'Raise'
                : action === '3bet' ? '3-Bet'
                    : action === '4bet' ? '4-Bet'
                        : action; // 5bet

    // Custom explanation logic
    let explanation = "";

    // --- FOLDS ---
    if (action === 'fold') {
        switch (category) {
            case 'Weak Offsuit Ace':
                explanation = "Weak offsuit aces are easily dominated and struggle to realize equity out of position.";
                if (villainPos.match(/UTG|HJ|CO/)) explanation += " The opener's range is too strong.";
                break;
            case 'Weak Ace':
                explanation = "Even being suited, this ace is too weak to withstand the pressure.";
                break;
            case 'Low Pair':
                explanation = "Set mining odds are insufficient here, and it has almost no other playability.";
                break;
            case 'Offsuit Broadway':
                explanation = "Likely dominated by the aggressor's range (AK, AQ, TT+). Reverse implied odds are high.";
                break;
            case 'Offsuit Trash':
            case 'Suited Trash':
                explanation = "It is not profitable to defend this hand against a strong range.";
                break;
            default:
                explanation = "This hand is slightly outside the profitable defense frequency against optimal play.";
        }
    }

    // --- CALLS ---
    else if (action === 'call') {
        switch (category) {
            case 'Low Pair':
            case 'Medium Pair':
                explanation = "Calling primarily to set mine. Ensure you are getting correct implied odds.";
                break;
            case 'Suited Connector':
            case 'Suited Gapper':
                explanation = "Calling for playability and implied odds. Plays well postflop even if you miss.";
                break;
            case 'Premium Ace':
            case 'Premium Pair':
                explanation = "Trapping / Flats to keep the opponent's bluffing range wide or to protect your calling range.";
                break;
            default:
                explanation = "Defending to prevent over-folding and to realize equity on favorable boards.";
        }
    }

    // --- RAISES (3BET/4BET) ---
    else if (['3bet', '4bet', '5bet', 'raise'].includes(action)) {
        // Bluff or Value?
        // Determine if it's a bluff candidate (Suited Wheel Aces, suited connectors)
        const isBluffLikely = ['A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s'].includes(norm) && category !== 'Premium Pair' && category !== 'Premium Ace';
        const isPremium = ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(norm);

        if (isPremium) {
            explanation = "Raising for pure value. You want to build the pot with a premium holding.";
        } else if (isBluffLikely) {
            if (norm.startsWith('A')) explanation = "Raising as information/bluff. The Ace blocker reduces probability Villain has AA/AK.";
            else explanation = "Raising as a semi-bluff with good playability if called.";
        } else {
            explanation = "Raising to deny equity and thin the field.";
        }
    }

    return `${actionStr} (${pct}%). ${explanation}`;
}
