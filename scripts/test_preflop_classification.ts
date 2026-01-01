
import { PreflopClassifier } from '../app/api/coach/utils/PreflopClassifier';

const TEST_HANDS = [
    { input: "Ah As", expectedTier: "MONSTER", expectedDesc: "Premium Pair" },
    { input: "9c 9d", expectedTier: "STRONG", expectedDesc: "Medium Pair" },
    { input: "Ac Kc", expectedTier: "MONSTER", expectedDesc: "Premium Suited Broadway" },
    { input: "As Qd", expectedTier: "STRONG", expectedDesc: "Premium Offsuit Broadway" },
    { input: "9h 8h", expectedTier: "STRONG", expectedDesc: "Suited Connector" },
    { input: "Ah 9d", expectedTier: "MARGINAL", expectedDesc: "High Card Ace" },
    { input: "7s 2c", expectedTier: "AIR", expectedDesc: "Weak Holdings" },
    // Short Format Test
    { input: "KK", expectedTier: "MONSTER", expectedDesc: "Premium Pair" },
    { input: "A9o", expectedTier: "MARGINAL", expectedDesc: "High Card Ace" },
    { input: "72o", expectedTier: "AIR", expectedDesc: "Weak Holdings" }
];

console.log('🧪 RUNNING PREFLOP CLASSIFIER TESTS...\n');

let passed = 0;
let failed = 0;

for (const test of TEST_HANDS) {
    const result = PreflopClassifier.classify(test.input);
    const passTier = result.tier === test.expectedTier;
    const passDesc = result.description === test.expectedDesc;

    if (passTier && passDesc) {
        console.log(`✅ ${test.input}: [${result.tier}] ${result.description}`);
        passed++;
    } else {
        console.error(`❌ ${test.input}: Expected [${test.expectedTier}] ${test.expectedDesc}, Got [${result.tier}] ${result.description}`);
        failed++;
        console.error(`   Output:`, result);
    }
}

console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);

if (failed > 0) process.exit(1);
process.exit(0);
