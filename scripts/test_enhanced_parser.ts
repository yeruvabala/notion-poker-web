/**
 * Test script for Phase 1 enhanced parser
 * 
 * Run with: npx ts-node scripts/test_enhanced_parser.ts
 */

import { enrichHandContext } from '../app/api/coach/utils/ParserFallbacks';

// Test cases for enhanced pattern matching
const testCases = [
    {
        name: 'Test 1: KJs shorthand suited',
        input: {
            rawText: 'hero with KJs on HJ, should hero open this hand?',
            heroPosition: 'HJ' as const
        },
        expect: {
            heroCards: 'KJs',
            scenario: 'opening',
            cardConfidence: '>80',
            scenarioConfidence: '>80'
        }
    },
    {
        name: 'Test 2: AKo shorthand offsuit',
        input: {
            rawText: 'I have AKo in cutoff, villain raised',
            heroPosition: 'CO' as const
        },
        expect: {
            heroCards: 'AKo',
            scenario: 'facing_action',
            villainPosition: 'detected'
        }
    },
    {
        name: 'Test 3: Pocket pair',
        input: {
            rawText: 'hero with KK on button, should I 3bet?',
            heroPosition: 'BTN' as const
        },
        expect: {
            heroCards: 'KK',
            scenario: 'opening'
        }
    },
    {
        name: 'Test 4: Opening from HJ',
        input: {
            rawText: 'opens from HJ with AJs, does hero open this?',
        },
        expect: {
            heroCards: 'AJs',
            heroPosition: 'detected',
            scenario: 'opening'
        }
    },
    {
        name: 'Test 5: Postflop scenario',
        input: {
            rawText: 'on the flop hero checks with AK',
            heroCards: 'AK'
        },
        expect: {
            scenario: 'postflop'
        }
    }
];

console.log('🧪 Enhanced Parser Test Suite\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const test of testCases) {
    console.log(`\n📝 ${test.name}`);
    console.log(`Input: "${test.input.rawText}"`);

    try {
        const enriched = enrichHandContext(test.input as any);

        // Check hero cards
        if (test.expect.heroCards) {
            if (enriched.heroCards === test.expect.heroCards) {
                console.log(`  ✅ Cards: ${enriched.heroCards}`);
                passed++;
            } else {
                console.log(`  ❌ Cards: Expected "${test.expect.heroCards}", got "${enriched.heroCards}"`);
                failed++;
            }
        }

        // Check scenario
        if (test.expect.scenario) {
            if (enriched.scenario === test.expect.scenario) {
                console.log(`  ✅ Scenario: ${enriched.scenario}`);
                passed++;
            } else {
                console.log(`  ❌ Scenario: Expected "${test.expect.scenario}", got "${enriched.scenario}"`);
                failed++;
            }
        }

        // Show all assumptions
        console.log(`  📊 Assumptions (${enriched.assumptions.length}):`);
        for (const assumption of enriched.assumptions.slice(0, 3)) {
            console.log(`    - ${assumption.field}: ${assumption.value} (${assumption.confidence}% ${assumption.source})`);
        }

    } catch (error: any) {
        console.log(`  💥 Error: ${error.message}`);
        failed++;
    }
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(`Success rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);
