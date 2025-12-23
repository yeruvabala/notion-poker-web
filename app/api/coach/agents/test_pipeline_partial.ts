/**
 * Test Script: Multi-Agent Pipeline Test (Agents 0-3)
 * 
 * Tests the first 4 agents with the KT hand example.
 * Run with: npx tsx app/api/coach/agents/test_pipeline_partial.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && !key.startsWith('#')) {
            process.env[key.trim()] = value.join('=').trim();
        }
    });
}

import { agent0_boardAnalyzer } from './agent0_boardAnalyzer';
import { agent1_rangeBuilder } from './agent1_rangeBuilder';
import { agent2_equityCalculator } from './agent2_equityCalculator';
import { agent3_advantageAnalyzer } from './agent3_advantageAnalyzer';
import { Action } from '../types/agentContracts';

async function testPartialPipeline() {
    console.log('═'.repeat(60));
    console.log('  MULTI-AGENT PIPELINE TEST (Agents 0-3)');
    console.log('═'.repeat(60));
    console.log('\n📋 Test Hand: K♥T♥ on K♠9♦5♣ A♠ 2♣\n');

    // Test data - the KT hand we've been discussing
    const testInput = {
        cards: 'K♥T♥',
        board: 'K♠ 9♦ 5♣ A♠ 2♣',
        positions: {
            hero: 'UTG',
            villain: 'BTN'
        },
        actions: [
            { street: 'preflop', player: 'hero', action: 'raise', amount: 2.5 },
            { street: 'preflop', player: 'villain', action: 'call', amount: 2.5 },
            { street: 'flop', player: 'hero', action: 'bet', amount: 4 },
            { street: 'flop', player: 'villain', action: 'call', amount: 4 },
            { street: 'turn', player: 'hero', action: 'check' },
            { street: 'turn', player: 'villain', action: 'bet', amount: 6 },
            { street: 'turn', player: 'hero', action: 'call', amount: 6 },
            { street: 'river', player: 'hero', action: 'check' },
            { street: 'river', player: 'villain', action: 'bet', amount: 12 },
        ] as Action[],
        potSize: 25,
        betSize: 12
    };

    try {
        // ═══════════════════════════════════════════════
        // TIER 1: Agent 0 - Board Analyzer
        // ═══════════════════════════════════════════════
        console.log('─'.repeat(60));
        console.log('🃏 AGENT 0: Board Analyzer');
        console.log('─'.repeat(60));

        const boardAnalysis = await agent0_boardAnalyzer({
            board: testInput.board
        });

        console.log('\n✅ Board Analysis:');
        console.log(JSON.stringify(boardAnalysis, null, 2));

        // ═══════════════════════════════════════════════
        // TIER 2: Agent 1 - Range Builder
        // ═══════════════════════════════════════════════
        console.log('\n' + '─'.repeat(60));
        console.log('📊 AGENT 1: Range Builder');
        console.log('─'.repeat(60));

        const ranges = await agent1_rangeBuilder({
            boardAnalysis: boardAnalysis,
            positions: testInput.positions,
            actions: testInput.actions
        });

        console.log('\n✅ Ranges:');
        console.log(JSON.stringify(ranges, null, 2));

        // ═══════════════════════════════════════════════
        // TIER 3: Agent 2 - Equity Calculator (parallel with Agent 3)
        // ═══════════════════════════════════════════════
        console.log('\n' + '─'.repeat(60));
        console.log('🧮 AGENT 2: Equity Calculator');
        console.log('─'.repeat(60));

        // Get villain range from Agent 1
        const villainRange = ranges.river?.villain_range ||
            ranges.turn?.villain_range ||
            ranges.flop?.villain_range ||
            ranges.preflop.villain_range.description;

        const equity = await agent2_equityCalculator({
            heroHand: testInput.cards,
            villainRange: villainRange,
            board: testInput.board,
            potSize: testInput.potSize,
            betSize: testInput.betSize
        });

        console.log('\n✅ Equity Analysis:');
        console.log(JSON.stringify(equity, null, 2));

        // ═══════════════════════════════════════════════
        // TIER 3: Agent 3 - Advantage Analyzer (parallel with Agent 2)
        // ═══════════════════════════════════════════════
        console.log('\n' + '─'.repeat(60));
        console.log('🏆 AGENT 3: Advantage Analyzer');
        console.log('─'.repeat(60));

        const advantages = await agent3_advantageAnalyzer({
            boardAnalysis: boardAnalysis,
            ranges: ranges,
            heroHand: testInput.cards
        });

        console.log('\n✅ Advantages:');
        console.log(JSON.stringify(advantages, null, 2));

        // ═══════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('  TEST SUMMARY');
        console.log('═'.repeat(60));
        console.log('\n✅ Agent 0 (Board): PASSED');
        console.log('✅ Agent 1 (Ranges): PASSED');
        console.log('✅ Agent 2 (Equity): PASSED');
        console.log('✅ Agent 3 (Advantages): PASSED');

        // Key checks
        console.log('\n📋 KEY VALIDATIONS:');
        console.log(`- Board texture detected: ${boardAnalysis.flop?.texture || 'N/A'}`);
        console.log(`- Hero range (preflop): ${ranges.preflop.hero_range.description}`);
        console.log(`- Equity vs range: ${(equity.equity_vs_range * 100).toFixed(1)}%`);
        console.log(`- Decision: ${equity.decision}`);
        console.log(`- Range advantage: ${advantages.flop?.range_advantage?.leader || 'N/A'}`);
        console.log(`- Nut advantage: ${advantages.flop?.nut_advantage?.leader || 'N/A'}`);
        console.log(`- Blockers: ${advantages.blocker_effects?.hero_blocks?.join(', ') || 'None'}`);

        console.log('\n✅ All 4 agents passed! Ready for Agents 4-6.');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
    }
}

// Run the test
testPartialPipeline();
