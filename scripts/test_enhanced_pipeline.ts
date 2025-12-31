/**
 * Test Hand Analysis with Enhanced System
 * 
 * Hand: AsJh on BTN vs SB 3-bet
 * Flop: Tc 5s Js (pair + backdoor flush draw)
 * Turn: Ah (two pair)
 */

import { runMultiAgentPipeline } from '../app/api/coach/analyze-hand/pipeline';

async function testEnhancedPipeline() {
    console.log('═══════════════════════════════════════════════════');
    console.log('Testing Enhanced Pipeline (Phases 12-14.5)');
    console.log('═══════════════════════════════════════════════════\n');

    const handInput = {
        // Hero info
        cards: 'AsJh',
        position: 'BTN',

        // Board
        board: 'Tc5sJsAh',

        // Table info
        tableSize: 6,

        // Stacks (in BB)
        stacks: {
            hero: 224,  // $56.13 / $0.25
            villain: 100 // $25.11 / $0.25
        },

        // Pot sizes (in BB)
        potSizes: {
            preflop: 12,    // $3.00 / $0.25
            flop: 24,       // ($3 + $3 + $2.56 + $2.56) / $0.25 ≈ 24
            turn: 43        // $10.81 / $0.25 ≈ 43
        },

        // Hero's actions
        heroActions: {
            preflop: {
                first: { action: 'raise' as const },
                second: { action: 'call' as const }  // Called the 3-bet
            },
            flop: {
                first: { action: 'call' as const }   // Faced bet, called
            },
            turn: {
                first: { action: 'bet' as const }    // Villain checked, hero bet
            }
        },

        // Actions for context
        actions: [
            { player: 'hero', action: 'raise', street: 'preflop', cards: 'AsJh' },
            { player: 'villain', action: 'raise', street: 'preflop' },
            { player: 'hero', action: 'call', street: 'preflop' },
            { player: 'villain', action: 'bet', street: 'flop' },
            { player: 'hero', action: 'call', street: 'flop' },
            { player: 'villain', action: 'check', street: 'turn' },
            { player: 'hero', action: 'bet', street: 'turn' }
        ],

        // Board analysis input
        boardAnalysis: {
            flop: {
                cards: 'Tc5sJs',
                texture: 'disconnected' as const,
                high_card: 'J'
            },
            turn: {
                cards: 'Ah',
                texture: 'paired' as const
            }
        },

        // Positions
        positions: {
            hero: 'BTN',
            villain: 'SB',
            relative: 'IP' as const
        },

        // Villain context
        villainContext: {
            is_3bettor: true,  // Villain 3-bet preflop
            facing_hero_open: true
        }
    };

    try {
        console.log('📋 Hand Summary:');
        console.log('  Hero: AsJh on BTN');
        console.log('  Villain: SB (3-bettor)');
        console.log('  Board: Tc 5s Js | Ah');
        console.log('  Result: Hero two pair, villain folds turn\n');

        const result = await runMultiAgentPipeline(handInput as any);

        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 ANALYSIS RESULTS');
        console.log('═══════════════════════════════════════════════════\n');

        // Phase 12: Hero Classification
        console.log('🎯 HERO HAND CLASSIFICATION (Phase 12):');
        console.log(`  Bucket: ${result.heroClassification?.bucket2D || 'N/A'}`);
        console.log(`  Tier: ${result.heroClassification?.tier || 'N/A'}`);
        console.log(`  Percentile: ${result.heroClassification?.percentile || 'N/A'}`);
        console.log(`  ${result.heroClassification?.description || 'N/A'}\n`);

        // Phase 13/13.5: Enhanced SPR
        console.log('💰 SPR ANALYSIS (Phase 13/13.5):');
        console.log(`  Flop SPR: ${result.spr?.flop_spr?.toFixed(1)}`);
        console.log(`  Turn SPR: ${result.spr?.turn_spr?.toFixed(1)}`);
        console.log(`  Zone: ${result.spr?.spr_zone}`);
        console.log(`  Commitment: ${result.spr?.commitment_thresholds?.min_hand_strength}`);
        console.log(`  Can fold TPTK: ${result.spr?.commitment_thresholds?.can_fold_tptk ? 'YES' : 'NO'}`);
        console.log(`  Shove zone: ${result.spr?.commitment_thresholds?.shove_zone ? 'YES' : 'NO'}\n`);

        // Phase 14/14.5: Mistake Detection with Leaks
        console.log('🎯 MISTAKE ANALYSIS (Phase 14/14.5):');
        console.log(`  Optimal: ${result.mistakes?.summary?.optimal_count || 0}`);
        console.log(`  Acceptable: ${result.mistakes?.summary?.acceptable_count || 0}`);
        console.log(`  Mistakes: ${result.mistakes?.summary?.mistake_count || 0}`);

        if (result.mistakes?.leak_categories && result.mistakes.leak_categories.length > 0) {
            console.log('\n  📊 Leak Breakdown:');
            result.mistakes.leak_categories.forEach((leak: any) => {
                console.log(`    - ${leak.category}: ${leak.count} mistake(s)`);
                leak.examples.forEach((ex: string) => console.log(`      └─ ${ex}`));
            });
        }

        if (result.mistakes?.worst_leak) {
            console.log(`\n  🚨 Primary Leak: ${result.mistakes.worst_leak}`);
        }

        console.log('\n═══════════════════════════════════════════════════');
        console.log('✅ Enhanced Pipeline Test Complete!');
        console.log('═══════════════════════════════════════════════════');

        return result;

    } catch (error) {
        console.error('❌ Error running pipeline:', error);
        throw error;
    }
}

// Run the test
testEnhancedPipeline().then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
