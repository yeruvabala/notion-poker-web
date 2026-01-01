
/**
 * Preflop Classifier: "The Hand Value Engine"
 * 
 * PURPOSE: Scientifically categorize hole cards into tiers and buckets.
 * USED BY: Agent 1 (Range Builder)
 * 
 * Logic:
 * - Pairs: Premium (AA-TT), Medium (99-66), Small (55-22)
 * - Broadways: Suited (AKs-QTs), Offsuit (AKo-QJo)
 * - Suited Connectors: Premium (T9s-54s), Gappers (T8s)
 * - Aces: Suited (A9s-A2s), Offsuit (A9o-A2o)
 * - Air: Everything else
 */

export interface HandClassification {
    bucket2D: string;      // (P,P), (S,S), (O,O), (0,0) - for verification
    tier: "MONSTER" | "STRONG" | "MARGINAL" | "AIR";
    percentile: string;    // "Top 5%", "Top 20%"
    description: string;   // "Premium Pair", "Suited Connector"
    interpretation: string; // "Raise for value", "Speculative call"
}

export class PreflopClassifier {

    static classify(hand: string): HandClassification {
        if (!hand || hand.length < 2) {
            return {
                bucket2D: "(0,0)",
                tier: "AIR",
                percentile: "Unknown",
                description: "Unknown Hand",
                interpretation: "Waiting for cards"
            };
        }

        // Normalize (Simple Parse)
        // Assume format "AhKs" or "AKs" or "AsKh"
        // We need ranks and suitedness
        const ranks = "23456789TJQKA";

        let rank1Char = '';
        let rank2Char = '';
        let isSuited = false;
        let isPair = false;

        // Clean input
        const clean = hand.replace(/\s+/g, '').replace(/10/g, 'T').toUpperCase();

        // Parsing Logic
        if (clean.length === 2 || (clean.length === 3 && (clean.endsWith('O') || clean.endsWith('S')))) {
            // Short format: "AA", "AKs", "AKo"
            rank1Char = clean[0];
            rank2Char = clean[1];
            isPair = rank1Char === rank2Char;
            isSuited = clean.endsWith('S');
        } else if (clean.length === 4) {
            // Full format: "AhKs"
            rank1Char = clean[0];
            rank2Char = clean[2];

            // Check suits
            const s1 = clean[1];
            const s2 = clean[3];
            isSuited = s1 === s2;
            isPair = rank1Char === rank2Char;
        } else {
            // Fallback for messy input
            return {
                bucket2D: "(0,0)",
                tier: "AIR",
                percentile: "Unknown",
                description: "Invalid Hand Format",
                interpretation: "Cannot analyze"
            };
        }

        // Values
        const val1 = ranks.indexOf(rank1Char);
        const val2 = ranks.indexOf(rank2Char);
        if (val1 === -1 || val2 === -1) {
            return {
                bucket2D: "(0,0)",
                tier: "AIR",
                percentile: "Unknown",
                description: "Invalid Ranks",
                interpretation: "Cannot analyze"
            };
        }

        const highVal = Math.max(val1, val2);
        const lowVal = Math.min(val1, val2);
        const gap = highVal - lowVal;
        const isConnected = gap === 1;
        const isOneGapper = gap === 2;

        // 1. PAIRS
        if (isPair) {
            if (highVal >= 10) { // QQ, KK, AA, JJ, TT
                return {
                    bucket2D: "(P,P)",
                    tier: "MONSTER",
                    percentile: "Top 5%",
                    description: "Premium Pair",
                    interpretation: "Raise/4-Bet for Value"
                };
            }
            if (highVal >= 6) { // 99, 88, 77, 66
                return {
                    bucket2D: "(P,P)",
                    tier: "STRONG",
                    percentile: "Top 10%",
                    description: "Medium Pair",
                    interpretation: "Set Mine / Bluff Catch"
                };
            }
            // 55-22
            return {
                bucket2D: "(P,P)",
                tier: "MARGINAL",
                percentile: "Top 20%",
                description: "Small Pair",
                interpretation: "Set Mine Cheaply"
            };
        }

        // 2. BROADWAYS (Both cards T+)
        const isBroadways = highVal >= 8 && lowVal >= 8; // T is index 8
        if (isBroadways) {
            if (isSuited) {
                if (highVal >= 11 && lowVal >= 10) { // AKs, AQs, KQs
                    return {
                        bucket2D: "(S,S)",
                        tier: "MONSTER",
                        percentile: "Top 5%",
                        description: "Premium Suited Broadway",
                        interpretation: "Raise/3-Bet for Value"
                    };
                }
                return {
                    bucket2D: "(S,S)",
                    tier: "STRONG",
                    percentile: "Top 15%",
                    description: "Suited Broadway",
                    interpretation: "Strong Opening Hand"
                };
            }
            // Offsuit Broadways
            if (highVal >= 11 && lowVal >= 10) { // AKo, AQo, KQo
                return {
                    bucket2D: "(O,O)",
                    tier: "STRONG",
                    percentile: "Top 15%",
                    description: "Premium Offsuit Broadway",
                    interpretation: "Raise for Value"
                };
            }
            return {
                bucket2D: "(O,O)",
                tier: "MARGINAL",
                percentile: "Top 25%",
                description: "Offsuit Broadway",
                interpretation: "Playable / Steal Hand"
            };
        }

        // 3. SUITED ACES
        if (isSuited && (highVal === 12 || lowVal === 12)) { // Includes Aces
            // Already handled Broadways, so these are A9s-A2s
            return {
                bucket2D: "(S,S)",
                tier: "STRONG",
                percentile: "Top 20%",
                description: "Suited Ace",
                interpretation: "Nut Flush Potential / Bluff 3-Bet"
            };
        }

        // 4. SUITED CONNECTORS
        if (isSuited) {
            if (isConnected && highVal >= 3) { // 54s+
                return {
                    bucket2D: "(S,S)",
                    tier: "STRONG",
                    percentile: "Top 25%",
                    description: "Suited Connector",
                    interpretation: "High Playability / Speculative"
                };
            }
            if (isOneGapper && highVal >= 4) { // 64s+
                return {
                    bucket2D: "(S,S)",
                    tier: "MARGINAL",
                    percentile: "Top 35%",
                    description: "Suited Gapper",
                    interpretation: "Speculative / Steal"
                };
            }
        }

        // 5. OFFSUIT ACES
        if (!isSuited && (highVal === 12 || lowVal === 12)) {
            // A9o-A2o
            if (lowVal >= 7) { // A9o
                return {
                    bucket2D: "(O,O)",
                    tier: "MARGINAL",
                    percentile: "Top 40%",
                    description: "High Card Ace",
                    interpretation: "Showdown Value / Bluff Catcher"
                };
            }
            return {
                bucket2D: "(O,O)",
                tier: "AIR",
                percentile: "Bottom 50%",
                description: "Weak Ace",
                interpretation: "Fold to Aggression"
            };
        }

        // 6. TRASH
        return {
            bucket2D: isSuited ? "(S,S)" : "(O,O)",
            tier: "AIR",
            percentile: "Bottom 50%",
            description: "Weak Holdings",
            interpretation: "Fold / Check-Fold"
        };
    }
}
