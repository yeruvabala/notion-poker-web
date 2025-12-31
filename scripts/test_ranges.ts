/**
 * Verification Script for Range Reactor
 * Run with: npx ts-node scripts/test_ranges.ts
 */

import { RangeEngine, BucketCategory } from '../app/api/coach/utils/RangeEngine';

function log(testName: string, passed: boolean, details: string) {
    console.log(`${passed ? '✅' : '❌'} [${testName}] ${details}`);
}

async function runTests() {
    console.log('🧪 Starting Range Reactor Tests...\n');

    // 1. Preflop Initialization
    try {
        const utgRange = RangeEngine.initializeRange('UTG', 'UTG', 'open');
        const stats = RangeEngine.getStats(utgRange);

        // UTG should be around 10-15% of hands (~150-200 combos)
        const count = stats.totalCombos;
        const isTight = count > 100 && count < 300;
        log('Preflop UTG Range', isTight, `Count: ${count.toFixed(1)} combos`);

        const btnRange = RangeEngine.initializeRange('BTN', 'BTN', 'open');
        const btnStats = RangeEngine.getStats(btnRange);
        const isWide = btnStats.totalCombos > 400;
        log('Preflop BTN Range', isWide, `Count: ${btnStats.totalCombos.toFixed(1)} combos (Should be > 400)`);
    } catch (e) {
        log('Preflop Init', false, String(e));
    }

    // 2. Card Removal
    try {
        const initial = RangeEngine.initializeRange('BTN', 'BTN', 'open');
        // Hero holds As Ks. Board has Qs.
        // Villain cannot have As, Ks, Qs.
        const deadCards = ['As', 'Ks', 'Qs'];
        const filtered = RangeEngine.applyCardRemoval(initial, deadCards);

        const hasDeadCard = filtered.some(c =>
            c.hand.includes('As') || c.hand.includes('Ks') || c.hand.includes('Qs')
        );

        log('Card Removal', !hasDeadCard, `Filtered range size: ${filtered.length} (Initial: ${initial.length})`);
    } catch (e) {
        log('Card Removal', false, String(e));
    }

    // 3. Bucket Categorization
    try {
        // Range: 22+, Ax, Kx
        // Board: Ah 7s 2c
        // 22 -> Set (Monster)
        // AK -> TPTK (Strong)
        // K7 -> Top Pair Weak (Marginal)? No, K7 is Second Pair (Marginal).
        // 72 -> Two Pair (Monster? Strong?)

        const testRange = [
            { hand: '2s2d', weight: 1 }, // Set
            { hand: 'AsKh', weight: 1 }, // TPTK
            { hand: 'Ks7h', weight: 1 }, // Second Pair
            { hand: 'QJc', weight: 1 }, // Air
        ];

        const bucketed = RangeEngine.categorizeRange(testRange, ['Ah', '7s', '2c']);

        const set = bucketed.find(c => c.hand === '2s2d');
        const tptk = bucketed.find(c => c.hand === 'AsKh');
        const mid = bucketed.find(c => c.hand === 'Ks7h');
        const air = bucketed.find(c => c.hand === 'QJc');

        const checks = [
            set?.bucket === BucketCategory.MONSTER,
            tptk?.bucket === BucketCategory.STRONG,
            mid?.bucket === BucketCategory.MARGINAL,
            air?.bucket === BucketCategory.AIR
        ];

        log('Bucketing Logic', checks.every(Boolean),
            `Set:${set?.bucket}, TPTK:${tptk?.bucket}, Mid:${mid?.bucket}, Air:${air?.bucket}`);

    } catch (e) {
        log('Bucketing Logic', false, String(e));
    }

    // 4. Action Filtering (The Funnel)
    try {
        // Villain Calls Flop
        // Air should be reduced significantly
        const testRange = [
            { hand: '2s2d', weight: 1, bucket: BucketCategory.MONSTER },
            { hand: 'QJc', weight: 1, bucket: BucketCategory.AIR },
        ];

        const called = RangeEngine.applyActionFilter(testRange, 'call', true);
        const airWeight = called.find(c => c.hand === 'QJc')?.weight || 0;
        const monsterWeight = called.find(c => c.hand === '2s2d')?.weight || 0;

        log('Action Filter (Call)', airWeight < 0.1 && monsterWeight > 0.7,
            `Air Weight: ${airWeight}, Monster Weight: ${monsterWeight}`);

    } catch (e) {
        log('Action Filter', false, String(e));
    }
}

runTests();
