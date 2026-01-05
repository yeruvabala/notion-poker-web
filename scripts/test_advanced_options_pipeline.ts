/**
 * Test: Verify Advanced Options UI → Pipeline JSON Format
 * 
 * This script simulates the data flow from HomeClient.tsx → replayerBuilder.ts
 * and validates that the output matches what the pipeline expects.
 * 
 * Run with: npx tsx scripts/test_advanced_options_pipeline.ts
 */

import { buildReplayerData } from '../app/api/coach/utils/replayerBuilder';

console.log('🧪 Testing Advanced Options → Pipeline Integration\n');
console.log('='.repeat(60));

// Simulate UI input (what HomeClient.tsx would send)
const mockUIInput = {
    // From payload
    position: 'BTN',
    villainPosition: 'BB',
    cards: 'AKs', // Hero cards in shorthand
    boardCards: ['K♠', 'Q♥', '3♦', '8♣'], // Turn card included

    // Preflop actions from UI
    preflopActions: [
        { player: 'H' as const, action: 'raise', amount: 2.5 },
        { player: 'V' as const, action: 'call', amount: 2.5 }
    ],

    // Flop actions from UI
    flopActions: [
        { player: 'V' as const, action: 'check' },
        { player: 'H' as const, action: 'bet', amount: 4 },
        { player: 'V' as const, action: 'call', amount: 4 }
    ],

    // Turn actions from UI
    turnActions: [
        { player: 'V' as const, action: 'check' },
        { player: 'H' as const, action: 'bet', amount: 8 }
    ],

    potSize: 22, // Total pot
    stakes: '1/2'
};

console.log('\n📥 Input (simulating HomeClient payload):');
console.log(JSON.stringify(mockUIInput, null, 2));

// Build replayer_data (what replayerBuilder produces)
const replayerData = buildReplayerData(
    'BTN opens, BB calls. Flop K♠ Q♥ 3♦. Check, bet 4bb, call. Turn 8♣. Check, bet 8bb.',
    undefined, // No enriched context needed for this test
    {
        position: mockUIInput.position,
        villainPosition: mockUIInput.villainPosition,
        cards: mockUIInput.cards,
        boardCards: mockUIInput.boardCards,
        preflopActions: mockUIInput.preflopActions,
        flopActions: mockUIInput.flopActions,
        turnActions: mockUIInput.turnActions,
        potSize: mockUIInput.potSize,
        stakes: mockUIInput.stakes
    }
);

console.log('\n📤 Output (replayer_data for pipeline):');
console.log(JSON.stringify(replayerData, null, 2));

// Validate structure
console.log('\n✅ Validation Checks:');

const checks = [
    {
        name: 'Has 2 players',
        pass: replayerData.players.length >= 2
    },
    {
        name: 'Hero identified correctly',
        pass: replayerData.players[0].isHero === true && replayerData.players[0].name === 'Hero'
    },
    {
        name: 'Hero position set',
        pass: replayerData.players[0].position === 'BTN'
    },
    {
        name: 'Villain position set',
        pass: replayerData.players[1].position === 'BB'
    },
    {
        name: 'Hero cards converted (shorthand → literal)',
        pass: replayerData.players[0].cards !== null && replayerData.players[0].cards!.length === 2
    },
    {
        name: 'Board has 4 cards (flop + turn)',
        pass: replayerData.board.length === 4
    },
    {
        name: 'Street is "turn"',
        pass: replayerData.street === 'turn'
    },
    {
        name: 'Preflop actions included',
        pass: replayerData.actions.filter(a => a.street === 'preflop').length === 2
    },
    {
        name: 'Flop actions included',
        pass: replayerData.actions.filter(a => a.street === 'flop').length === 3
    },
    {
        name: 'Turn actions included',
        pass: replayerData.actions.filter(a => a.street === 'turn').length === 2
    },
    {
        name: 'Pot size set',
        pass: replayerData.pot === mockUIInput.potSize
    }
];

let passCount = 0;
for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon} ${check.name}`);
    if (check.pass) passCount++;
}

console.log('\n' + '='.repeat(60));
console.log(`📊 Results: ${passCount}/${checks.length} checks passed`);

if (passCount === checks.length) {
    console.log('🎉 All validations passed! JSON format is correct for pipeline.\n');
    process.exit(0);
} else {
    console.log('⚠️  Some validations failed. Review the output above.\n');
    process.exit(1);
}
