/**
 * FULL PIPELINE TEST - All 7 Agents with Prompt Logging
 * 
 * This test runs all agents and logs the EXACT prompts sent to the LLM
 * so you can analyze what the model is receiving.
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx app/api/coach/agents/test_full_pipeline.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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

import { agent0_boardAnalyzer, BOARD_ANALYZER_SYSTEM_PROMPT } from './agent0_boardAnalyzer';
import { agent1_rangeBuilder, RANGE_BUILDER_SYSTEM_PROMPT } from './agent1_rangeBuilder';
import { agent2_equityCalculator } from './agent2_equityCalculator';
import { agent3_advantageAnalyzer } from './agent3_advantageAnalyzer';
import { agent4_sprCalculator } from './agent4_sprCalculator';
import { agent5_gtoStrategy, GTO_STRATEGY_PROMPT, formatContextForPrompt } from './agent5_gtoStrategy';
import { agent6_mistakeDetector, MISTAKE_DETECTOR_PROMPT } from './agent6_mistakeDetector';
import { Action, HeroActions } from '../types/agentContracts';

// Store all prompts for later display
const promptLog: { agent: string; systemPrompt: string; userPrompt: string }[] = [];

async function runFullPipelineTest() {
    console.log('═'.repeat(70));
    console.log('  FULL MULTI-AGENT PIPELINE TEST (All 7 Agents)');
    console.log('═'.repeat(70));
    console.log('\n📋 Test Hand: K♥T♥ on K♠9♦5♣ A♠ 2♣\n');
    console.log('Hero: UTG raises → BTN calls → Hero bets flop → BTN calls');
    console.log('       Hero checks turn → BTN bets → Hero calls');
    console.log('       Hero checks river → BTN bets $12\n');

    // Test input - same KT hand
    const testInput = {
        cards: 'K♥T♥',
        board: 'K♠ 9♦ 5♣ A♠ 2♣',
        positions: { hero: 'UTG', villain: 'BTN' },
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
        potSizes: { preflop: 6, flop: 14, turn: 26, river: 38 },
        stacks: { hero: 100, villain: 100 },
        potSize: 38,
        betSize: 12,
        heroActions: {
            preflop: { action: 'raise', amount: 2.5 },
            flop: { action: 'bet', amount: 4 },
            turn: { action: 'call', amount: 6 },
            river: { action: 'call', amount: 12 }  // Hero called the $12 river bet
        } as HeroActions
    };

    const startTime = Date.now();

    try {
        // ═══════════════════════════════════════════════════════════════
        // TIER 1: Agent 0 - Board Analyzer
        // ═══════════════════════════════════════════════════════════════
        console.log('─'.repeat(70));
        console.log('🃏 AGENT 0: Board Analyzer');
        console.log('─'.repeat(70));

        // Log prompt
        const agent0UserPrompt = `Analyze this poker board:\n\nFlop: K♠ 9♦ 5♣\nTurn: A♠\nRiver: 2♣\n\nProvide complete board texture analysis.`;
        promptLog.push({
            agent: 'Agent 0: Board Analyzer',
            systemPrompt: BOARD_ANALYZER_SYSTEM_PROMPT,
            userPrompt: agent0UserPrompt
        });

        const boardAnalysis = await agent0_boardAnalyzer({ board: testInput.board });
        console.log('✅ Board Analysis:', JSON.stringify(boardAnalysis, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // TIER 2: Agent 1 + Agent 4 (Parallel in production)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '─'.repeat(70));
        console.log('📊 AGENT 1: Range Builder');
        console.log('─'.repeat(70));

        const agent1Result = await agent1_rangeBuilder({
            boardAnalysis,
            positions: testInput.positions,
            actions: testInput.actions,
            stacks: testInput.stacks
        });
        const { ranges } = agent1Result;
        console.log('✅ Ranges:', JSON.stringify(ranges, null, 2));

        console.log('\n' + '─'.repeat(70));
        console.log('💰 AGENT 4: SPR Calculator (Pure JS - No LLM!)');
        console.log('─'.repeat(70));

        const spr = agent4_sprCalculator({
            potSizes: testInput.potSizes,
            stacks: testInput.stacks
        });
        console.log('✅ SPR Analysis:', JSON.stringify(spr, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // TIER 3: Agent 2 + Agent 3 (Parallel in production)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '─'.repeat(70));
        console.log('🧮 AGENT 2: Equity Calculator');
        console.log('─'.repeat(70));

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
        console.log('✅ Equity:', JSON.stringify(equity, null, 2));

        console.log('\n' + '─'.repeat(70));
        console.log('🏆 AGENT 3: Advantage Analyzer');
        console.log('─'.repeat(70));

        const advantages = await agent3_advantageAnalyzer({
            boardAnalysis,
            ranges,
            heroHand: testInput.cards
        });
        console.log('✅ Advantages:', JSON.stringify(advantages, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // TIER 4: Agent 5 - GTO Strategy
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '─'.repeat(70));
        console.log('🎯 AGENT 5: GTO Strategy Generator');
        console.log('─'.repeat(70));

        const agent5Input = {
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            heroHand: testInput.cards,
            positions: testInput.positions,
            actions: testInput.actions
        };

        // Log the formatted context for Agent 5
        const agent5Context = formatContextForPrompt(agent5Input);
        promptLog.push({
            agent: 'Agent 5: GTO Strategy',
            systemPrompt: GTO_STRATEGY_PROMPT,
            userPrompt: `Based on this complete analysis, provide the GTO optimal strategy for each street:\n\n${agent5Context}`
        });

        const gtoStrategy = await agent5_gtoStrategy(agent5Input);
        console.log('✅ GTO Strategy:', JSON.stringify(gtoStrategy, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // TIER 5: Agent 6 - Mistake Detector
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '─'.repeat(70));
        console.log('⚠️ AGENT 6: Mistake Detector');
        console.log('─'.repeat(70));

        const mistakes = await agent6_mistakeDetector({
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            gtoStrategy,
            heroActions: testInput.heroActions,
            positions: testInput.positions
        });
        console.log('✅ Mistakes:', JSON.stringify(mistakes, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════════
        const totalTime = Date.now() - startTime;

        console.log('\n' + '═'.repeat(70));
        console.log('  TEST SUMMARY');
        console.log('═'.repeat(70));
        console.log('\n✅ All 7 agents completed successfully!');
        console.log(`\n⏱️ Total execution time: ${(totalTime / 1000).toFixed(1)} seconds`);

        console.log('\n📋 Final Analysis:');
        console.log(`   Board: ${boardAnalysis.flop?.texture || 'N/A'}`);
        console.log(`   Hero equity: ${(equity.equity_vs_range * 100).toFixed(1)}%`);
        console.log(`   Pot odds needed: ${(equity.pot_odds.equity_needed * 100).toFixed(1)}%`);
        console.log(`   Range advantage: ${advantages.flop?.range_advantage?.leader || 'N/A'}`);
        console.log(`   SPR on river: ${spr.river_spr?.toFixed(1) || 'N/A'}`);
        console.log(`   GTO river action: ${gtoStrategy.river?.initial_action?.primary?.action || 'N/A'}`);
        console.log(`   Mistakes found: ${mistakes.mistakes?.length || 0}`);
        console.log(`   Total EV lost: $${mistakes.total_ev_lost?.toFixed(2) || '0.00'}`);

        // ═══════════════════════════════════════════════════════════════
        // RAW PROMPTS (What you asked for!)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n\n' + '═'.repeat(70));
        console.log('  RAW PROMPTS SENT TO LLM');
        console.log('═'.repeat(70));

        for (const log of promptLog) {
            console.log('\n' + '─'.repeat(70));
            console.log(`📝 ${log.agent}`);
            console.log('─'.repeat(70));
            console.log('\n[SYSTEM PROMPT]:');
            console.log(log.systemPrompt);
            console.log('\n[USER PROMPT]:');
            console.log(log.userPrompt);
        }

    } catch (error) {
        console.error('\n❌ PIPELINE FAILED:', error);
    }
}

// Run the test
runFullPipelineTest();
