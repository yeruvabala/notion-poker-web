
/**
 * Analyze hand string to determine if it is Suited or Offsuit
 * @param hand e.g. "Ad 2c" or "Kh Kd"
 * @returns "(Suited)" | "(Offsuit)" | "" (if pair or invalid)
 */
export function getHandType(hand: string): string {
    try {
        const clean = hand.replace(/[^a-zA-Z0-9]/g, ''); // "Ad 2c" -> "Ad2c"
        if (clean.length === 4) {
            const r1 = clean[0];
            const s1 = clean[1];
            const r2 = clean[2];
            const s2 = clean[3];

            // If Pair, irrelevant (Ad Ac is just Pair)
            // But technically it's offsuit. 
            // In poker notation, Pairs are just Pairs.
            // Let's only tag non-pairs.
            if (r1 === r2) return '';

            return s1 === s2 ? '(Suited)' : '(Offsuit)';
        }
    } catch (e) { return ''; }
    return '';
}
