/**
 * Test: Enhanced SPR Calculator (Phase 13)
 * 
 * Verifies all 5 SPR zones and strategic thresholds
 */

import { agent4_sprCalculator } from '../app/api/coach/agents/agent4_sprCalculator';

console.log('═══════════════════════════════════════════════════');
console.log('Phase 13: Enhanced SPR Calculator Test');
console.log('═══════════════════════════════════════════════════\n');

// Test Scenarios
const scenarios = [
    {
        name: 'POT_COMMITTED (SPR < 2)',
        pot: 50,
        stacks: { hero: 80, villain: 100 },
        expectedZone: 'POT_COMMITTED',
        expectedSPR: 1.6,
        expectedMinStrength: 'Any made hand or strong Ace',
        expectedShoveZone: true
    },
    {
        name: 'COMMITTED (SPR 2-4)',
        pot: 25,
        stacks: { hero: 80, villain: 100 },
        expectedZone: 'COMMITTED',
        expectedSPR: 3.2,
        expectedMinStrength: 'Top pair+',
        expectedShoveZone: true
    },
    {
        name: 'MEDIUM (SPR 4-8)',
        pot: 12,
        stacks: { hero: 75, villain: 100 },
        expectedZone: 'MEDIUM',
        expectedSPR: 6.25,
        expectedMinStrength: 'TPTK+',
        expectedShoveZone: false
    },
    {
        name: 'DEEP (SPR 8-13)',
        pot: 7,
        stacks: { hero: 75, villain: 100 },
        expectedZone: 'DEEP',
        expectedSPR: 10.7,
        expectedMinStrength: 'Two pair+',
        expectedShoveZone: false
    },
    {
        name: 'VERY_DEEP (SPR > 13)',
        pot: 4,
        stacks: { hero: 80, villain: 100 },
        expectedZone: 'VERY_DEEP',
        expectedSPR: 20,
        expectedMinStrength: 'Sets+ (near-nuts)',
        expectedShoveZone: false
    }
];

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
    console.log(`\nTest: ${scenario.name}`);
    console.log(`  Pot: ${scenario.pot}, Stacks: ${scenario.stacks.hero}/${scenario.stacks.villain}`);

    const result = agent4_sprCalculator({
        potSizes: { flop: scenario.pot },
        stacks: scenario.stacks
    });

    const actualSPR = result.flop_spr || 0;

    // Verify zone
    if (result.spr_zone === scenario.expectedZone) {
        console.log(`  ✅ Zone: ${result.spr_zone} (correct)`);
        passed++;
    } else {
        console.log(`  ❌ Zone: ${result.spr_zone} (expected ${scenario.expectedZone})`);
        failed++;
    }

    // Verify SPR calculation
    if (Math.abs(actualSPR - scenario.expectedSPR) < 0.1) {
        console.log(`  ✅ SPR: ${actualSPR.toFixed(2)} (correct)`);
        passed++;
    } else {
        console.log(`  ❌ SPR: ${actualSPR.toFixed(2)} (expected ${scenario.expectedSPR})`);
        failed++;
    }

    // Verify threshold
    if (result.commitment_thresholds.min_hand_strength === scenario.expectedMinStrength) {
        console.log(`  ✅ Min Strength: "${result.commitment_thresholds.min_hand_strength}"`);
        passed++;
    } else {
        console.log(`  ❌ Min Strength: "${result.commitment_thresholds.min_hand_strength}"`);
        console.log(`     Expected: "${scenario.expectedMinStrength}"`);
        failed++;
    }

    // Verify shove zone
    if (result.commitment_thresholds.shove_zone === scenario.expectedShoveZone) {
        console.log(`  ✅ Shove Zone: ${result.commitment_thresholds.shove_zone}`);
        passed++;
    } else {
        console.log(`  ❌ Shove Zone: ${result.commitment_thresholds.shove_zone} (expected ${scenario.expectedShoveZone})`);
        failed++;
    }

    // Display additional context
    console.log(`  📊 Optimal Value Bet: ${result.optimal_sizing.value_bet}`);
    console.log(`  📊 Future SPR (after pot bet): ${result.future_spr.after_pot_bet}`);
    console.log(`  📊 Stack Commitment: ${(result.stack_commitment.percent_invested * 100).toFixed(0)}%`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════');

if (failed === 0) {
    console.log('\n✅ All SPR zones working correctly!');
    console.log('Phase 13: COMPLETE');
} else {
    console.log('\n❌ Some tests failed - review threshold logic');
    process.exit(1);
}
