/**
 * Re-analyze existing hand with Phase 15 enhancements
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reanalyzeHand(handId: string) {
    console.log(`🔄 Re-analyzing hand ${handId} with Phase 15 enhancements...`);

    try {
        // Trigger re-analysis by calling the coach API
        const response = await fetch('http://localhost:3000/api/coach/analyze-hand', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hand_id: handId,
                force_reanalysis: true
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Re-analysis complete!');
            console.log('GTO Strategy updated with Phase 15 enhancements');
            console.log('\nCheck the hand in your UI to see:');
            console.log('- Strategic context (hand tier, SPR zone)');
            console.log('- Educational WHY explanations');
            console.log('- Multi-street planning');
        } else {
            console.error('❌ Re-analysis failed:', result);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Get hand ID from command line or use a default
const handId = process.argv[2];

if (!handId) {
    console.log('Usage: npx tsx scripts/reanaly ze_hand.ts <hand_id>');
    console.log('\nTo find hand IDs, check your database or use:');
    console.log('SELECT id, cards, position FROM hands ORDER BY date DESC LIMIT 10;');
    process.exit(1);
}

reanalyzeHand(handId);
