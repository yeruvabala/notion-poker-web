#!/usr/bin/env node
/**
 * GTO Ranges Validation & Testing Suite
 * 
 * This script validates all preflop range data for:
 * 1. Data Integrity (frequency sums, overlaps)
 * 2. Coverage (missing scenarios)
 * 3. Functional Testing (actual range lookups)
 */

import { normalizeHand, getOpeningAction, getFacingOpenAction, getVs3BetAction } from '../app/api/coach/utils/gtoRanges';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST DATA: Representative hands for each scenario
// ============================================================================

const TEST_HANDS = {
    premium: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
    strong: ['AQs', 'AJs', 'KQs', 'TT', '99'],
    medium: ['88', '77', 'ATs', 'KJs', 'QJs'],
    speculative: ['A5s', 'A4s', '76s', '65s', '54s'],
    marginal: ['A9o', 'KTo', 'QJo', '22', '33'],
    trash: ['72o', '83o', 'J2o', '94o']
};

// ============================================================================
// PHASE 1: DATA INTEGRITY VALIDATION
// ============================================================================

function validateFrequencyIntegrity() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PHASE 1: DATA INTEGRITY VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const issues: string[] = [];

    // Read gtoRanges.ts file
    const rangesPath = path.join(__dirname, '../app/api/coach/utils/gtoRanges.ts');
    const content = fs.readFileSync(rangesPath, 'utf-8');

    // Extract range constants from file
    const extractRange = (name: string) => {
        const regex = new RegExp(`const ${name}[^=]+= \\{(.*?)\\n\\};`, 's');
        const match = content.match(regex);
        return match ? match[0] : null;
    };

    const threeBetSection = extractRange('THREE_BET_RANGES');
    const vsThreeBetSection = extractRange('VS_THREE_BET_RANGES');
    const vsFourBetSection = extractRange('VS_FOUR_BET_RANGES');

    if (!threeBetSection || !vsThreeBetSection || !vsFourBetSection) {
        if (!threeBetSection) console.log('❌ Could not parse THREE_BET_RANGES');
        if (!vsThreeBetSection) console.log('❌ Could not parse VS_THREE_BET_RANGES');
        if (!vsFourBetSection) console.log('❌ Could not parse VS_FOUR_BET_RANGES');
        return;
    }

    // Parse and validate each range object
    const rangeSections = [
        { name: 'THREE_BET_RANGES', content: threeBetSection },
        { name: 'VS_THREE_BET_RANGES', content: vsThreeBetSection },
        { name: 'VS_FOUR_BET_RANGES', content: vsFourBetSection }
    ];

    rangeSections.forEach(({ name, content: sectionContent }) => {
        console.log(`\n🔍 Validating ${name}...`);

        // Extract scenario keys (e.g., 'BB_vs_BTN')
        const scenarioMatches = sectionContent.matchAll(/'([a-zA-Z_0-9]+)':\s*{/g);
        const scenarios = Array.from(scenarioMatches).map(m => m[1]);

        console.log(`   Found ${scenarios.length} scenarios`);

        scenarios.forEach(scenario => {
            // Extract the scenario block
            const scenarioRegex = new RegExp(`'${scenario}':\\s*{([^}]+(?:{[^}]+}[^}]+)*)}`, 's');
            const scenarioMatch = sectionContent.match(scenarioRegex);

            if (!scenarioMatch) return;

            const scenarioBlock = scenarioMatch[1];

            // Extract action types (3bet, call, 4bet, 5bet_shove, etc.)
            const actionMatches = scenarioBlock.matchAll(/'([a-z_]+)':\s*{([^}]+)}/g);
            const actions = Array.from(actionMatches);

            // Build hand frequency map
            const handFreqs: Record<string, Record<string, number>> = {};

            actions.forEach(([, actionType, handsBlock]) => {
                const handMatches = handsBlock.matchAll(/'([A-Z0-9]+)':\s*([0-9.]+)/g);
                Array.from(handMatches).forEach(([, hand, freq]) => {
                    if (!handFreqs[hand]) handFreqs[hand] = {};
                    handFreqs[hand][actionType] = parseFloat(freq);
                });
            });

            // Check for frequency sum violations
            Object.entries(handFreqs).forEach(([hand, freqMap]) => {
                const sum = Object.values(freqMap).reduce((a, b) => a + b, 0);
                if (sum > 1.01) { // Allow small floating point errors
                    const details = Object.entries(freqMap)
                        .map(([action, freq]) => `${action}=${freq}`)
                        .join(', ');
                    issues.push(
                        `❌ ${name}.${scenario}.${hand}: Frequencies sum to ${sum.toFixed(2)} (${details})`
                    );
                }
            });
        });
    });

    if (issues.length === 0) {
        console.log('\n✅ All frequency integrity checks PASSED');
    } else {
        console.log(`\n❌ Found ${issues.length} frequency integrity issues:\n`);
        issues.forEach(issue => console.log(issue));
    }

    return issues;
}

// ============================================================================
// PHASE 2: COVERAGE VALIDATION
// ============================================================================

function validateCoverage() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗺️  PHASE 2: COVERAGE VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const expectedScenarios = {
        'THREE_BET_RANGES': [
            'SB_vs_BTN', 'BB_vs_BTN', 'BB_vs_CO', 'BB_vs_UTG',
            'BB_vs_HJ', 'BB_vs_MP', 'BB_vs_SB',
            'SB_vs_UTG', 'SB_vs_HJ', 'SB_vs_CO',
            'BTN_vs_UTG', 'BTN_vs_HJ', 'BTN_vs_CO'
        ],
        'VS_THREE_BET_RANGES': [
            'BTN_vs_SB_3bet', 'CO_vs_BB_3bet',
            'UTG_vs_HJ_3bet', 'UTG_vs_BTN_3bet', 'UTG_vs_BB_3bet',
            'HJ_vs_BTN_3bet', 'HJ_vs_BB_3bet',
            'MP_vs_BTN_3bet', 'MP_vs_BB_3bet',
            'CO_vs_BTN_3bet', 'CO_vs_SB_3bet',
            'BTN_vs_BB_3bet', 'SB_vs_BB_3bet'
        ],
        'VS_FOUR_BET_RANGES': [
            'BB_3bet_vs_BTN_4bet', 'BB_3bet_vs_UTG_4bet', 'BB_3bet_vs_HJ_4bet',
            'SB_3bet_vs_BTN_4bet', 'SB_3bet_vs_UTG_4bet',
            'BTN_3bet_vs_CO_4bet'
        ]
    };

    const rangesPath = path.join(__dirname, '../app/api/coach/utils/gtoRanges.ts');
    const content = fs.readFileSync(rangesPath, 'utf-8');

    Object.entries(expectedScenarios).forEach(([rangeType, scenarios]) => {
        console.log(`\n📋 Checking ${rangeType}:`);
        const missing: string[] = [];
        const found: string[] = [];

        scenarios.forEach(scenario => {
            if (content.includes(`'${scenario}':`)) {
                found.push(scenario);
            } else {
                missing.push(scenario);
            }
        });

        console.log(`   ✅ Found: ${found.length}/${scenarios.length}`);
        if (missing.length > 0) {
            console.log(`   ❌ Missing: ${missing.join(', ')}`);
        }
    });
}

// ============================================================================
// PHASE 3: FUNCTIONAL TESTING
// ============================================================================

function functionalTests() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 PHASE 3: FUNCTIONAL TESTING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const tests: Array<{ name: string, test: () => void }> = [];

    // Test 1: A9o BTN vs SB 3-bet (THE ORIGINAL BUG)
    tests.push({
        name: 'A9o BTN vs SB 3-bet should FOLD',
        test: () => {
            const result = getVs3BetAction('A9o', 'BTN', 'SB');
            if (result.action.action !== 'fold') {
                throw new Error(`Expected fold, got ${result.action.action} (freq: ${result.action.frequency})`);
            }
            if (result.source !== 'range_table') {
                throw new Error(`Expected range_table source, got ${result.source}`);
            }
            console.log(`   ✅ A9o correctly returns FOLD`);
        }
    });

    // Test 2: AA BTN vs SB 3-bet should 4-BET
    tests.push({
        name: 'AA BTN vs SB 3-bet should 4-BET',
        test: () => {
            const result = getVs3BetAction('AA', 'BTN', 'SB');
            if (result.action.action !== '4bet') {
                throw new Error(`Expected 4bet, got ${result.action.action}`);
            }
            console.log(`   ✅ AA correctly returns 4-BET`);
        }
    });

    // Test 3: JJ BTN vs SB 3-bet should CALL
    tests.push({
        name: 'JJ BTN vs SB 3-bet should CALL',
        test: () => {
            const result = getVs3BetAction('JJ', 'BTN', 'SB');
            if (result.action.action !== 'call') {
                throw new Error(`Expected call, got ${result.action.action}`);
            }
            console.log(`   ✅ JJ correctly returns CALL`);
        }
    });

    // Test 4: BB vs BTN open with medium hand
    tests.push({
        name: 'QJs BB vs BTN should have deterministic action',
        test: () => {
            const result = getFacingOpenAction('QJs', 'BB', 'BTN');
            if (result.source === 'llm_fallback') {
                throw new Error('Should use range_table, not LLM');
            }
            console.log(`   ✅ QJs BB vs BTN: ${result.action.action} (freq: ${result.action.frequency})`);
        }
    });

    // Test 5: Opening ranges
    tests.push({
        name: 'BTN opening range sanity check',
        test: () => {
            const trash = getOpeningAction('72o', 'BTN');
            const premium = getOpeningAction('AA', 'BTN');

            if (trash.action.action !== 'fold') {
                throw new Error('72o should fold from BTN');
            }
            if (premium.action.action !== 'raise') {
                throw new Error('AA should raise from BTN');
            }
            console.log(`   ✅ BTN opening ranges working (AA=raise, 72o=fold)`);
        }
    });

    // Run all tests
    let passed = 0;
    let failed = 0;

    tests.forEach(({ name, test }) => {
        try {
            test();
            passed++;
        } catch (error) {
            failed++;
            console.log(`   ❌ FAILED: ${name}`);
            console.log(`      ${(error as Error).message}`);
        }
    });

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
}

// ============================================================================
// PHASE 4: COMPREHENSIVE HAND SAMPLING
// ============================================================================

function comprehensiveHandSampling() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎲 PHASE 4: COMPREHENSIVE HAND SAMPLING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const scenarios = [
        { name: 'BTN vs SB 3-bet', fn: (h: string) => getVs3BetAction(h, 'BTN', 'SB') },
        { name: 'CO vs BB 3-bet', fn: (h: string) => getVs3BetAction(h, 'CO', 'BB') },
        { name: 'BB vs BTN open', fn: (h: string) => getFacingOpenAction(h, 'BB', 'BTN') },
    ];

    scenarios.forEach(({ name, fn }) => {
        console.log(`\n📍 Testing: ${name}`);

        let rangeCount = 0;
        let llmCount = 0;

        Object.entries(TEST_HANDS).forEach(([category, hands]) => {
            hands.forEach(hand => {
                try {
                    const result = fn(hand);
                    const source = result.source === 'range_table' ? '✓' : '⚠';
                    console.log(`   ${source} ${hand.padEnd(4)} (${category.padEnd(11)}) → ${result.action.action}`);

                    if (result.source === 'range_table') rangeCount++;
                    else llmCount++;
                } catch (e) {
                    console.log(`   ❌ ${hand.padEnd(4)} → ERROR: ${(e as Error).message}`);
                }
            });
        });

        console.log(`   Summary: ${rangeCount} from ranges, ${llmCount} from LLM fallback`);
    });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   GTO RANGES VALIDATION & TESTING SUITE                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    validateFrequencyIntegrity();
    validateCoverage();
    functionalTests();
    comprehensiveHandSampling();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VALIDATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
