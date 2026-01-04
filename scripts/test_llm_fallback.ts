/**
 * Test LLM Fallback System
 * Tests both high confidence (regex-only) and low confidence (LLM fallback)
 */

import { enrichHandContext } from '../app/api/coach/utils/ParserFallbacks';

async function testLLMFallback() {
    console.log('🧪 Testing LLM Fallback System\n');
    console.log('='.repeat(60));

    // Test 1: High confidence - should NOT trigger LLM
    console.log('\n📝 Test 1: High Confidence (Regex-only)');
    console.log('Input: "hero on BTN with KJs"');

    const test1 = await enrichHandContext({
        rawText: 'hero on BTN with KJs, should I open?',
    });

    console.log(`  Position: ${test1.heroPosition}`);
    console.log(`  Cards: ${test1.heroCards}`);
    console.log(`  Confidence: ${test1.parsingConfidence}%`);
    console.log(`  AI Fallback: ${test1.isAiFallback ? '✨ YES' : '❌ NO'}`);
    console.log(`  ✅ Expected: Regex-only, no LLM call`);

    // Test 2: Fuzzy input - should trigger LLM
    console.log('\n📝 Test 2: Fuzzy Input (LLM Fallback)');
    console.log('Input: "sitting next to dealer with ace king suited"');

    const test2 = await enrichHandContext({
        rawText: 'sitting next to dealer with ace king suited',
    });

    console.log(`  Position: ${test2.heroPosition || 'undefined'}`);
    console.log(`  Cards: ${test2.heroCards || 'undefined'}`);
    console.log(`  Confidence: ${test2.parsingConfidence}%`);
    console.log(`  AI Fallback: ${test2.isAiFallback ? '✨ YES' : '❌ NO'}`);

    if (test2.isAiFallback) {
        console.log(`  ✅ SUCCESS: LLM fallback triggered!`);
        console.log(`  Assumptions:`);
        test2.assumptions
            .filter(a => a.source === 'AI_Inferred')
            .forEach(a => {
                console.log(`    - ${a.field}: ${a.value} (${a.confidence}%)`);
            });
    } else {
        console.log(`  ⚠️  LLM fallback did NOT trigger`);
        console.log(`  Check: OPENAI_API_KEY configured?`);
    }

    // Test 3: Partial input - low confidence
    console.log('\n📝 Test 3: Partial Input (Missing Position)');
    console.log('Input: "hero with pocket nines"');

    const test3 = await enrichHandContext({
        rawText: 'hero with pocket nines',
    });

    console.log(`  Position: ${test3.heroPosition || 'undefined'}`);
    console.log(`  Cards: ${test3.heroCards || 'undefined'}`);
    console.log(`  Confidence: ${test3.parsingConfidence}%`);
    console.log(`  AI Fallback: ${test3.isAiFallback ? '✨ YES' : '❌ NO'}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`Test 1 (Clear): ${!test1.isAiFallback ? '✅' : '❌'} Regex-only`);
    console.log(`Test 2 (Fuzzy): ${test2.isAiFallback ? '✅' : '❌'} LLM triggered`);
    console.log(`Test 3 (Partial): ${test3.isAiFallback ? '✅' : '❌'} LLM triggered`);

    if (!test2.isAiFallback && !test3.isAiFallback) {
        console.log('\n⚠️  LLM fallback not working. Possible causes:');
        console.log('  1. OPENAI_API_KEY not set in .env');
        console.log('  2. ENABLE_LLM_FALLBACK=false');
        console.log('  3. OpenAI API error');
    } else {
        console.log('\n✅ LLM Fallback System Working!');
    }
}

// Run test
testLLMFallback().catch(console.error);
