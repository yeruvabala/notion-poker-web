
import { determineVillainContext } from '../app/api/coach/analyze-hand/pipeline';

const HERO_NAME = 'Hero';

function runTest(name: string, inputs: any, expectedType: string) {
    console.log(`\nTEST: ${name}`);
    try {
        const context = determineVillainContext(inputs.replayerData, inputs.heroPosition, HERO_NAME, '');
        const pass = context.type === expectedType;
        console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: Expected '${expectedType}', Got '${context.type}'`);
        if (!pass) {
            console.log('   Full Context:', JSON.stringify(context, null, 2));
            console.log('   Actions:', JSON.stringify(inputs.replayerData.actions, null, 2));
        }
    } catch (e: any) {
        console.error('❌ CRASH:', e.message);
    }
}

// ==========================================
// SCENARIO 1: Hero RFI (Opening)
// ==========================================
runTest('Hero RFI (UTG)', {
    heroPosition: 'UTG',
    replayerData: {
        players: [{ name: 'Hero', position: 'UTG' }, { name: 'Villain', position: 'BB' }],
        actions: [
            { street: 'preflop', player: 'Hero', action: 'raises', amount: 2.5 }
        ]
    }
}, 'opening');

// ==========================================
// SCENARIO 2: Facing Open
// ==========================================
runTest('Hero Facing Open (BB vs BTN)', {
    heroPosition: 'BB',
    replayerData: {
        players: [{ name: 'Hero', position: 'BB' }, { name: 'Villain', position: 'BTN' }],
        actions: [
            { street: 'preflop', player: 'Villain', action: 'raises', amount: 2.5 },
            // Hero has not acted yet in replayer data usually?
            // determineVillainContext needs to find Hero's action to know WHERE we are?
            // If Hero hasn't acted, heroActionIndex is -1.
            // Line 198: if -1, uses fallback (extractVillainPosition).
            // But it still returns 'facing_action' if extracted?
            // Let's assume standard flow where we mock Hero's "pending" action or just rely on fallback.
            // BUT pipeline.ts logic relies on finding Hero Action to check PRIOR raises.
            // If Hero hasn't acted, we can't define "Prior".
            // So we must simulate Hero acts (even if just Folds or Calls).
            { street: 'preflop', player: 'Hero', action: 'calls', amount: 2.5 }
        ]
    }
}, 'facing_action'); // facing_open maps to facing_action type

// ==========================================
// SCENARIO 3: Vs 3-Bet (The Fix)
// ==========================================
runTest('Hero Vs 3-Bet (BTN vs SB)', {
    heroPosition: 'BTN',
    replayerData: {
        players: [{ name: 'Hero', position: 'BTN' }, { name: 'Villain', position: 'SB' }],
        actions: [
            { street: 'preflop', player: 'Hero', action: 'raises', amount: 2.5 },
            { street: 'preflop', player: 'Villain', action: 'raises', amount: 9.0 },
            { street: 'preflop', player: 'Hero', action: 'calls', amount: 9.0 } // Decision point
        ]
    }
}, 'vs_3bet');

// ==========================================
// SCENARIO 4: Vs 4-Bet (The Fix)
// ==========================================
runTest('Hero Vs 4-Bet (BB vs BTN)', {
    heroPosition: 'BB',
    replayerData: {
        players: [{ name: 'Hero', position: 'BB' }, { name: 'Villain', position: 'BTN' }],
        actions: [
            { street: 'preflop', player: 'Villain', action: 'raises', amount: 2.5 },
            { street: 'preflop', player: 'Hero', action: 'raises', amount: 9.0 }, // Hero 3-bet
            { street: 'preflop', player: 'Villain', action: 'raises', amount: 25.0 }, // Villain 4-bet
            { street: 'preflop', player: 'Hero', action: 'calls', amount: 25.0 } // Decision point
        ]
    }
}, 'vs_4bet');

// ==========================================
// SCENARIO 5: SB vs BB (Blind War)
// ==========================================
runTest('SB vs BB (RFI)', {
    heroPosition: 'SB',
    replayerData: {
        players: [{ name: 'Hero', position: 'SB' }, { name: 'Villain', position: 'BB' }],
        actions: [
            { street: 'preflop', player: 'Hero', action: 'raises', amount: 3.0 }
        ]
    }
}, 'sb_vs_bb'); // Special type

// ==========================================
// SCENARIO 6: BB vs SB (Facing Open)
// ==========================================
runTest('BB vs SB Open', {
    heroPosition: 'BB',
    replayerData: {
        players: [{ name: 'Hero', position: 'BB' }, { name: 'Villain', position: 'SB' }],
        actions: [
            { street: 'preflop', player: 'Villain', action: 'raises', amount: 3.0 },
            { street: 'preflop', player: 'Hero', action: 'calls', amount: 3.0 }
        ]
    }
}, 'facing_action'); // Should simply be facing_action (context: Villain=SB)
