/**
 * Test suite for 9-max position detection
 * Tests: UTG+1, UTG+2, MP and common abbreviations
 * 
 * Run with: npx tsx scripts/test_9max_positions.ts
 */

import { enrichHandContext } from '../app/api/coach/utils/ParserFallbacks';

const testCases = [
    // 9-max explicit positions
    {
        name: 'Test 1: UTG+1 explicit',
        input: {
            rawText: 'hero on UTG+1 with KJs',
        },
        expect: {
            heroPosition: 'UTG+1'
        }
    },
    {
        name: 'Test 2: UTG+1 abbreviation (utg1)',
        input: {
            rawText: 'hero on utg1 with AKo',
        },
        expect: {
            heroPosition: 'UTG+1'
        }
    },
    {
        name: 'Test 3: UTG+2 explicit',
        input: {
            rawText: 'hero on UTG+2 with 99',
        },
        expect: {
            heroPosition: 'UTG+2'
        }
    },
    {
        name: 'Test 4: UTG+2 abbreviation (utg2)',
        input: {
            rawText: 'hero on utg2 with QJs',
        },
        expect: {
            heroPosition: 'UTG+2'
        }
    },
    {
        name: 'Test 5: MP explicit',
        input: {
            rawText: 'hero on MP with AKs',
        },
        expect: {
            heroPosition: 'MP'
        }
    },
    {
        name: 'Test 6: MP abbreviation (middle)',
        input: {
            rawText: 'hero in middle with KK',
        },
        expect: {
            heroPosition: 'MP'
        }
    },
    {
        name: 'Test 7: Button abbreviation (but)',
        input: {
            rawText: 'hero on but with KJs',
        },
        expect: {
            heroPosition: 'BTN'
        }
    },
    {
        name: 'Test 8: Cutoff abbreviation (cut)',
        input: {
            rawText: 'hero on cut with AKo',
        },
        expect: {
            heroPosition: 'CO'
        }
    },
    {
        name: 'Test 9: Hijack abbreviation (hi)',
        input: {
            rawText: 'hero on hi with 99',
        },
        expect: {
            heroPosition: 'HJ'
        }
    },
];

console.log('🧪 9-Max Position Detection Test Suite\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;


(async () => {
    for (const test of testCases) {
        console.log(`\n📝 ${test.name}`);
        console.log(`Input: "${test.input.rawText}"`);

        try {
            const enriched = await enrichHandContext(test.input as any);

            // Check hero position
            if (test.expect.heroPosition) {
                if (enriched.heroPosition === test.expect.heroPosition) {
                    console.log(`  ✅ Position: ${enriched.heroPosition}`);
                    passed++;
                } else {
                    console.log(`  ❌ Position: Expected "${test.expect.heroPosition}", got "${enriched.heroPosition}"`);
                    failed++;
                }
            }

            // Show assumptions
            console.log(`  📊 Assumptions (${enriched.assumptions.length}):`);
            for (const assumption of enriched.assumptions.slice(0, 2)) {
                console.log(`    - ${assumption.field}: ${assumption.value} (${assumption.confidence}%)`);
            }

        } catch (error: any) {
            console.log(`  💥 Error: ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    console.log(`Success rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);
})();

// Also test that normalization works correctly for ranges
console.log('\n🔄 Testing Range Normalization:\n');
import { normalizePosition } from '../app/api/coach/utils/gtoRangesV2';

const normTests = [
    { input: 'UTG+1', expected: 'UTG' },
    { input: 'UTG+2', expected: 'UTG' },
    { input: 'MP', expected: 'HJ' },
    { input: 'BTN', expected: 'BTN' },
    { input: 'CO', expected: 'CO' },
];

for (const test of normTests) {
    const result = normalizePosition(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.input} → ${result} (expected: ${test.expected})`);
}
