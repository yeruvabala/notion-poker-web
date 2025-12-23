/**
 * Test script for Agent 0: Board Analyzer
 * 
 * Run with: npx ts-node app/api/coach/agents/test_agent0.ts
 */

import { agent0_boardAnalyzer } from './agent0_boardAnalyzer';

async function testAgent0() {
    console.log('Testing Agent 0: Board Analyzer\n');
    console.log('='.repeat(50));

    // Test 1: Standard flop + turn + river
    console.log('\n📋 Test 1: Full board (K♠9♦5♣ A♠ 2♣)');
    console.log('-'.repeat(50));
    const test1 = await agent0_boardAnalyzer({
        board: 'K♠ 9♦ 5♣ A♠ 2♣'
    });
    console.log(JSON.stringify(test1, null, 2));

    // Test 2: Flop only (wet board with draws)
    console.log('\n📋 Test 2: Flop only - wet board (T♠ J♠ Q♣)');
    console.log('-'.repeat(50));
    const test2 = await agent0_boardAnalyzer({
        board: 'T♠ J♠ Q♣'
    });
    console.log(JSON.stringify(test2, null, 2));

    // Test 3: Paired board
    console.log('\n📋 Test 3: Paired board (7♠ 7♦ 2♣ K♥)');
    console.log('-'.repeat(50));
    const test3 = await agent0_boardAnalyzer({
        board: '7♠ 7♦ 2♣ K♥'
    });
    console.log(JSON.stringify(test3, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('✅ Agent 0 testing complete!');
}

testAgent0().catch(console.error);
