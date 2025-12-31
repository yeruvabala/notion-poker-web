/**
 * Phase Validation Test
 * 
 * Tests that all 3 phases are working:
 * - Phase 2: Preflop ranges (code-first)
 * - Phase 3: Board classification (code-first)
 * - Phase 4: Hand classification (2D bucketing)
 */

import { classifyBoard } from '../utils/boardClassifier';
import { classifyHand, getBucketStrategy } from '../utils/handClassifier';
import { getOpeningAction, getPreflopAction, normalizeHand } from '../utils/gtoRanges';

async function runValidationTests() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           PHASE VALIDATION TESTS - All Phases          ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    // =====================================================================
    // PHASE 2: Preflop Ranges
    // =====================================================================
    console.log('📎 PHASE 2: Preflop Ranges (gtoRanges.ts)\n');

    const preflopTests = [
        { hero: 'As Ks', pos: 'BTN', expected: 'raise', desc: 'AKs from BTN should raise' },
        { hero: '7s 2h', pos: 'BTN', expected: 'fold', desc: '72o from BTN should fold' },
        { hero: 'Ah 5h', pos: 'CO', expected: 'raise', desc: 'A5s from CO should raise' },
        { hero: 'Qs Qd', pos: 'UTG', expected: 'raise', desc: 'QQ from UTG should raise' },
    ];

    for (const test of preflopTests) {
        const result = getOpeningAction(test.hero, test.pos);
        const action = result.action.action;
        const pass = action === test.expected;

        if (pass) {
            console.log(`  ✅ ${test.desc}`);
            console.log(`     → ${action} (${(result.action.frequency * 100).toFixed(0)}%)\n`);
            passed++;
        } else {
            console.log(`  ❌ ${test.desc}`);
            console.log(`     → Got ${action}, expected ${test.expected}\n`);
            failed++;
        }
    }

    // =====================================================================
    // PHASE 3: Board Classification
    // =====================================================================
    console.log('\n📎 PHASE 3: Board Classification (boardClassifier.ts)\n');

    const boardTests = [
        { board: 'Ah 7d 2c', expected: 'high_dry', desc: 'A-high rainbow dry' },
        { board: 'Kh Kd 5c', expected: 'paired', desc: 'Paired board' },
        { board: 'Ah 7h 2h', expected: 'monotone', desc: 'Monotone (flush possible)' },
        { board: 'Ts 9d 8c', expected: 'connected', desc: 'Connected board' },
    ];

    for (const test of boardTests) {
        const result = classifyBoard(test.board);
        const pass = result.type.includes(test.expected.split('_')[0]);

        if (pass) {
            console.log(`  ✅ ${test.desc}`);
            console.log(`     → ${result.type} (${result.description})\n`);
            passed++;
        } else {
            console.log(`  ❌ ${test.desc}`);
            console.log(`     → Got ${result.type}, expected ${test.expected}\n`);
            failed++;
        }
    }

    // =====================================================================
    // PHASE 4: Hand Classification (2D Bucketing)
    // =====================================================================
    console.log('\n📎 PHASE 4: Hand Classification (handClassifier.ts)\n');

    const handTests = [
        { hero: 'Ah Kh', board: 'Ac 7d 2c', expected: '(3,', desc: 'Top pair strong kicker' },
        { hero: 'Ks Kd', board: 'Qc 7d 2c', expected: '(3,', desc: 'Overpair' },
        { hero: 'Ah Kh', board: 'Qh 7h 2c', expected: ',2)', desc: 'Flush draw' },
        { hero: '5h 5d', board: 'Ah 5c 2c', expected: '(4,', desc: 'Set' },
    ];

    for (const test of handTests) {
        const result = classifyHand(test.hero, test.board);
        const pass = result.bucket2D.includes(test.expected);

        if (pass) {
            console.log(`  ✅ ${test.desc}`);
            console.log(`     → ${result.bucket2D} - ${result.description}`);
            console.log(`     → Strategy: ${getBucketStrategy(result)}\n`);
            passed++;
        } else {
            console.log(`  ❌ ${test.desc}`);
            console.log(`     → Got ${result.bucket2D}, expected to contain ${test.expected}\n`);
            failed++;
        }
    }

    // =====================================================================
    // SUMMARY
    // =====================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`           RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failed === 0) {
        console.log('🎉 ALL PHASES VALIDATED SUCCESSFULLY!\n');
    } else {
        console.log('⚠️  Some tests failed. Please review.\n');
    }

    return { passed, failed };
}

// Run tests
runValidationTests().catch(console.error);
