/**
 * TEST: Full Pipeline with Route.ts Format
 * 
 * This test simulates EXACTLY what route.ts receives from the backend.
 * Tests the transformer + all 7 agents.
 * 
 * Run: export $(grep -v '^#' .env.local | xargs) && npx tsx app/api/coach/analyze-hand/test_pipeline_with_route.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load env
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

import { transformToAgentInput, runMultiAgentPipeline } from './pipeline';

async function testPipelineWithRouteData() {
    console.log('═'.repeat(70));
    console.log('  TESTING PIPELINE WITH ROUTE.TS DATA FORMAT');
    console.log('═'.repeat(70));

    // ═══════════════════════════════════════════════════════════════
    // THIS IS EXACTLY WHAT route.ts RECEIVES FROM body.parsed
    // ═══════════════════════════════════════════════════════════════
    const routeBody = {
        // Raw hand text (what user uploaded)
        raw_text: `PokerStars Hand #123456789: Hold'em No Limit ($0.02/$0.05)
Table 'Test Table' 6-max Seat #3 is the button
Seat 1: villain ($5.00 in chips)
Seat 3: Hero ($5.00 in chips)
Hero: posts small blind $0.02
villain: posts big blind $0.05
*** HOLE CARDS ***
Dealt to Hero [Kh Th]
Hero: raises $0.10 to $0.15
villain: calls $0.10
*** FLOP *** [Ks 9d 5c]
Hero: bets $0.20
villain: calls $0.20
*** TURN *** [Ks 9d 5c] [As]
Hero: checks
villain: bets $0.30
Hero: calls $0.30
*** RIVER *** [Ks 9d 5c As] [2c]
Hero: checks
villain: bets $0.60
Hero: calls $0.60`,

        // Pre-parsed data from worker.py (what route.ts extracts)
        parsed: {
            cards: 'Kh Th',           // Hero's hole cards
            board: 'Ks 9d 5c As 2c',  // Community cards
            position: 'SB',            // Hero's position
            stakes: '0.02/0.05',       // Blinds
            pot_type: 'single_raised', // Not 3bet
            preflop_raises: 1          // One raise preflop
        }
    };

    console.log('\n📋 Input Data (what route.ts receives):');
    console.log('─'.repeat(70));
    console.log('parsed.cards:', routeBody.parsed.cards);
    console.log('parsed.board:', routeBody.parsed.board);
    console.log('parsed.position:', routeBody.parsed.position);
    console.log('─'.repeat(70));

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: Transform to Agent Input
        // ═══════════════════════════════════════════════════════════════
        console.log('\n🔄 STEP 1: Transforming data...');
        const agentInput = transformToAgentInput(routeBody);

        console.log('\n✅ Transformed Data:');
        console.log('─'.repeat(70));
        console.log('cards:', agentInput.cards);           // Should be "K♥T♥"
        console.log('board:', agentInput.board);           // Should be "K♠ 9♦ 5♣ A♠ 2♣"
        console.log('positions:', agentInput.positions);
        console.log('actions:', JSON.stringify(agentInput.actions, null, 2));
        console.log('heroActions:', agentInput.heroActions);
        console.log('─'.repeat(70));

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: Run Full Pipeline
        // ═══════════════════════════════════════════════════════════════
        console.log('\n🚀 STEP 2: Running multi-agent pipeline...\n');
        const startTime = Date.now();

        const result = await runMultiAgentPipeline(agentInput);

        const duration = Date.now() - startTime;

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: Show Results
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(70));
        console.log('  FINAL OUTPUT (What UI receives)');
        console.log('═'.repeat(70));

        console.log('\n📋 GTO STRATEGY:');
        console.log('─'.repeat(70));
        console.log(result.gto_strategy);

        console.log('\n📋 EXPLOIT DEVIATION:');
        console.log('─'.repeat(70));
        console.log(result.exploit_deviation);

        console.log('\n📋 LEARNING TAGS:');
        console.log('─'.repeat(70));
        console.log(result.learning_tag);

        console.log('\n📋 STRUCTURED DATA (for analysis tab):');
        console.log('─'.repeat(70));
        console.log('Mistakes:', result.structured_data?.mistakes?.length || 0);
        console.log('EV Lost:', result.structured_data?.mistakes?.reduce((sum: number, m: any) => sum + (m.ev_impact || 0), 0).toFixed(2));

        console.log('\n' + '═'.repeat(70));
        console.log(`  ✅ COMPLETE! Total time: ${(duration / 1000).toFixed(1)} seconds`);
        console.log('═'.repeat(70));

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
    }
}

testPipelineWithRouteData();
