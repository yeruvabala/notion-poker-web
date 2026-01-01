/**
 * MULTI-AGENT PIPELINE VALIDATION - USER HAND #2609912076
 * 
 * Hand: As Jh (Seat 4, BTN, KannyThOP)
 * Board: Tc 5s Js Ah
 * Villain: Arepitarica (Seat 5, SB)
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx app/api/coach/agents/test_multi_agent_phase4.ts
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

import { agent0_boardAnalyzer } from './agent0_boardAnalyzer';
import { agent1_rangeBuilder } from './agent1_rangeBuilder';
import { agent2_equityCalculator } from './agent2_equityCalculator';
import { agent3_advantageAnalyzer } from './agent3_advantageAnalyzer';
import { agent4_sprCalculator } from './agent4_sprCalculator';
import { agent5_gtoStrategy, formatContextForPrompt } from './agent5_gtoStrategy';
import { agent6_mistakeDetector } from './agent6_mistakeDetector';
import { classifyHand } from '../utils/handClassifier';
import { Action, HeroActions, Position, PotSizes, Stacks } from '../types/agentContracts';

async function runValidationHand() {
    console.log('═'.repeat(70));
    console.log('  PIPELINE VALIDATION: Hand #2609912076');
    console.log('═'.repeat(70));
    console.log('\n📋 Hand: As Jh (BTN) vs SB');
    console.log('Board: Tc 5s Js Ah');
    console.log('Action: Preflop Raise/Call, Flop Bet/Call, Turn Bet/Fold\n');

    // 1. Construct Hand Input based on history
    const heroHand = 'A♠ J♥'; // As Jh -> A♠ J♥
    const boardRaw = 'T♣ 5♠ J♠ A♥'; // Tc 5s Js Ah

    // Actions derived from logs:
    // KannyThOP raises $0.70
    // Arepitarica raises $3.00 (3-bet)
    // KannyThOP calls $2.30
    // Pot: 0.10(SB) + 0.25(BB) + 3.00(SB) + 3.00(BTN) = 6.35? 
    // Log says Main pot $5.94? Maybe some rake or folded blinds?
    // Seat 1-3, 6 folded.
    // SB posted 0.10. BB posted 0.25. 
    // Hero raised to 0.70. 
    // SB raised to 3.00. 
    // BB folded.
    // Hero called 2.30 more.
    // Pot = 3.00 (Hero) + 3.00 (SB) + 0.25 (BB dead) = 6.25?

    // Flop: Tc 5s Js
    // Arepitarica bets $2.56
    // KannyThOP calls $2.56
    // Pot = 6.25 + 2.56 + 2.56 = 11.37? 
    // Log says Turn Main pot $10.81 (Rake taken?)

    // Turn: Ah
    // Arepitarica checks
    // KannyThOP bets $7.40
    // Arepitarica folds

    const actions: Action[] = [
        // Preflop
        { street: 'preflop', player: 'hero', action: 'raise', amount: 0.70 },
        { street: 'preflop', player: 'villain', action: 'raise', amount: 3.00 },
        { street: 'preflop', player: 'hero', action: 'call', amount: 3.00 }, // Total committed
        // Flop
        { street: 'flop', player: 'villain', action: 'bet', amount: 2.56 },
        { street: 'flop', player: 'hero', action: 'call', amount: 2.56 },
        // Turn
        { street: 'turn', player: 'villain', action: 'check' },
        { street: 'turn', player: 'hero', action: 'bet', amount: 7.40 },
        { street: 'turn', player: 'villain', action: 'fold' }
    ];

    const heroActions: HeroActions = {
        preflop: { first: { action: 'raise', amount: 0.70 }, second: { action: 'call', amount: 3.00 } },
        flop: { first: { action: 'call', amount: 2.56 } },
        turn: { first: { action: 'bet', amount: 7.40 } }
    };

    const potSizes: PotSizes = {
        preflop: 6.25,
        flop: 11.37,
        turn: 11.37
    };

    const stacks: Stacks = {
        hero: 56.13,
        villain: 25.11
    };

    const positions: Position = {
        hero: 'BTN',
        villain: 'SB'
    };

    // Streets played: Preflop, Flop, Turn
    const streetsPlayed = {
        preflop: true,
        flop: true,
        turn: true, // Hand ended on Turn
        river: false
    };

    const villainContext = {
        type: 'sb_vs_bb' as const, // Actually BTN vs SB 3-bet -> logic similar to facing action
        villainName: 'Arepitarica'
    };

    // Actually, pipeline determines context. Input here mimics transformed input.
    // Since Hero (BTN) faced 3-bet from SB, it's "facing_action".
    const vContext = {
        type: 'facing_action' as const,
        villain: 'SB',
        villainName: 'Arepitarica'
    };

    console.log('🚀 Starting Pipeline...');
    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Board Analysis
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[1] Agent 0: Board Analyzer');
    const boardAnalysis = await agent0_boardAnalyzer({ board: boardRaw });
    console.log(`   Texture: ${boardAnalysis.flop?.texture}`);
    console.log(`   Turn Impact: ${boardAnalysis.turn?.impact}`);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: Hand Bucketing (Code-First)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[Phase 4] Hand Classification (Bucketing)');
    const handClassification = classifyHand(heroHand, boardRaw);
    console.log(`   Bucket: ${handClassification.bucket2D}`);
    console.log(`   Description: ${handClassification.description}`);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: Ranges & SPR
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[2] Agent 1 & 4: Ranges & SPR');
    const [agent1Result, spr] = await Promise.all([
        agent1_rangeBuilder({
            boardAnalysis,
            positions,
            actions,
            tableSize: 6,
            stacks
        }),
        Promise.resolve(agent4_sprCalculator({ potSizes, stacks }))
    ]);
    const { ranges } = agent1Result;
    console.log(`   Hero Range: ${ranges.preflop.hero_range.description}`);
    console.log(`   SPR Flop: ${spr.flop_spr?.toFixed(2)}`);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: Equity & Advantages
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[3] Agent 2 & 3: Equity & Advantages');
    const [equity, advantages] = await Promise.all([
        agent2_equityCalculator({
            heroHand,
            villainRange: ranges.turn?.villain_range || 'Unknown',
            board: boardRaw,
            potSize: 11.37,
            betSize: 0 // Villain checked turn
        }),
        agent3_advantageAnalyzer({ boardAnalysis, ranges, heroHand })
    ]);
    console.log(`   Equity: ${(equity.equity_vs_range * 100).toFixed(1)}%`);
    console.log(`   Nut Advantage (Flop): ${advantages.flop.nut_advantage.leader}`);

    // ═══════════════════════════════════════════════════════════════
    // AGENT 5: GTO Strategy
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[5] Agent 5: GTO Strategy');
    const gtoInput = {
        boardAnalysis,
        ranges,
        equity,
        advantages,
        spr,
        heroHand,
        positions,
        actions,
        streetsPlayed,
        villainContext: vContext,
        handClassification
    };

    const gtoStrategy = await agent5_gtoStrategy(gtoInput);

    // DEBUG: check preflop structure
    console.log('🔍 PREFLOP STRATEGY DEBUG:');
    console.log(JSON.stringify(gtoStrategy.preflop, null, 2));

    const raises = actions.filter(a => a.street === 'preflop' && a.action === 'raise');
    console.log(`🔍 HAS 3-BET? Raises: ${raises.length} -> ${raises.length >= 2}`);

    console.log('\n🎯 GTO STRATEGY OUTPUT:');
    console.log(JSON.stringify(gtoStrategy, null, 2));

    // ═══════════════════════════════════════════════════════════════
    // AGENT 6: Mistake Detector
    // ═══════════════════════════════════════════════════════════════
    console.log('\n[6] Agent 6: Mistake Detector');
    const mistakes = await agent6_mistakeDetector({
        boardAnalysis,
        ranges,
        equity,
        advantages,
        spr,
        gtoStrategy,
        heroActions,
        positions
    });

    console.log('\n❌ MISTAKE ANALYSIS:');
    console.log(JSON.stringify(mistakes, null, 2));

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Validation Complete in ${(totalTime / 1000).toFixed(2)}s`);
}

runValidationHand().catch(console.error);
