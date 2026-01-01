
import { runMultiAgentPipeline } from '../app/api/coach/analyze-hand/pipeline';

/**
 * Test A9o Preflop Classification in Full Pipeline
 * 
 * Scenario:
 * Hero (BTN) raises with A9o
 * Villain (SB) 3-bets
 * Hero folds
 * 
 * Goal: Ensure Hero Classification is populated (e.g. "Marginal / High Card Ace")
 * instead of "Unknown", so the tooltip appears.
 */

async function testPreflopTooltip() {
    console.log('═══════════════════════════════════════════════════');
    console.log('Testing Preflop Tooltip Pipeline (A9o No Board)');
    console.log('═══════════════════════════════════════════════════\n');

    const handInput = {
        cards: 'A9o', // Normalized
        position: 'BTN',
        board: '', // NO BOARD!
        tableSize: 6,
        stacks: { hero: 100, villain: 100 },
        potSizes: { preflop: 12 },

        // Mock actions mimicking the real log
        heroActions: {
            preflop: {
                first: { action: 'raise' as const },
                second: { action: 'fold' as const }
            }
        },

        actions: [
            { player: 'hero', action: 'raise', street: 'preflop', cards: 'A9o', amount: 3 },
            { player: 'villain', action: 'raise', street: 'preflop', amount: 12 },
            { player: 'hero', action: 'fold', street: 'preflop' }
        ],

        boardAnalysis: {}, // No flop
        positions: { hero: 'BTN', villain: 'SB' },
        villainContext: { type: 'facing_action', villain: 'SB' }
    };

    try {
        const result = await runMultiAgentPipeline(handInput as any);

        console.log('\n📊 RESULTS:');

        // CHECK 1: Hero Classification
        const cls = result.heroClassification;
        if (cls && cls.tier !== 'AIR' && cls.tier !== 'Unknown' && cls.description !== 'Unknown') {
            console.log('✅ Hero Classification Found:');
            console.log(`   Tier: ${cls.tier}`);
            console.log(`   Desc: ${cls.description}`);
            console.log(`   Interpretation: ${cls.interpretation}`);
        } else {
            console.error('❌ Hero Classification MISSING or EMPTY');
            console.error(cls);
        }

        // CHECK 2: GTO Strategy
        console.log('\n🧠 GTO Strategy Summary:');
        console.log(result.gtoStrategy.filter(l => l.includes('CRITICAL') || l.includes('VERIFIED')).join('\n'));

        // CHECK 3: Mistakes
        console.log('\n🚨 Mistakes Summary:');
        console.log(JSON.stringify(result.mistakes?.summary, null, 2));

    } catch (error) {
        console.error('❌ Pipeline Failed:', error);
    }
}

testPreflopTooltip();
