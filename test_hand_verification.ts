
import { agent5_gtoStrategy } from './app/api/coach/agents/agent5_gtoStrategy';
import { Agent5Input, ActionType } from './app/api/coach/types/agentContracts';

async function runTest() {
    const input: Agent5Input = {
        heroHand: "As Jh",
        positions: { hero: "BTN", villain: "SB" },
        // Mock data usually provided by previous agents
        boardAnalysis: {
            flop: { cards: "Tc 5s Js", texture: "Wet connected", draws_possible: ["Flush Draw", "Straight Draw"], scary_for: "low pairs" },
            turn: { card: "Ah", impact: "Completes some draws, hits Hero range", range_shift: "Hero Advantage" },
            summary: { is_paired: false, flush_possible: true, straight_possible: true, high_cards: ["A", "J", "T"] }
        },
        ranges: {
            preflop: {
                hero_range: { description: "22+, A2s+, K5s+, Q9s+, J9s+, A7o+, K9o+, QTo+, JTo", combos: 500, spectrum: "BTN Open" },
                villain_range: { description: "TT+, AJs+, KQs, AKo", combos: 80, spectrum: "SB 3-bet vs BTN" }
            }
        },
        equity: {
            equity_vs_range: 0.45,
            pot_odds: { pot_size: 10.81, to_call: 0, odds_ratio: "0", equity_needed: 0 },
            decision: "N/A"
        },
        advantages: {
            flop: {
                range_advantage: { leader: "villain", percentage: "55%", reason: "3-bettor hits high cards" },
                nut_advantage: { leader: "villain", hero_strongest: "Sets", villain_strongest: "Top Set", reason: "Villain has QQ+" }
            }
        },
        spr: {
            effective_stack: 25.00,
            flop_spr: 4.0, // approx
            spr_zone: "MEDIUM",
            zone_description: "Standard play",
            commitment_thresholds: {
                min_hand_strength: "Top Pair",
                can_fold_tptk: true,
                can_fold_overpair: true,
                shove_zone: false
            },
            stack_commitment: {
                percent_invested: 0.15,
                remaining_bb: 50,
                pot_bb: 12
            },
            future_spr: {
                after_half_pot_bet: 2.5,
                after_pot_bet: 1.5,
                streets_remaining: 2
            },
            optimal_sizing: {
                value_bet: "50-66%",
                bluff_bet: "33%",
                all_in_threshold: 1.5
            },
            commitment_analysis: {
                flop: "Not committed"
            }
        },
        actions: [
            { street: "preflop", player: "hero", action: "raise", amount: 0.70 },
            { street: "preflop", player: "villain", action: "raise", amount: 3.00 },
            { street: "preflop", player: "hero", action: "call", amount: 2.30 }, // The Call we want to analyze
            { street: "flop", player: "villain", action: "bet", amount: 2.56 },
            { street: "flop", player: "hero", action: "call", amount: 2.56 },
            { street: "turn", player: "villain", action: "check" },
            { street: "turn", player: "hero", action: "bet", amount: 7.40 }
        ],
        streetsPlayed: { preflop: true, flop: true, turn: true, river: false }
    };

    console.log("Running Agent 5 GTO Strategy...");
    const strategy = await agent5_gtoStrategy(input);
    console.log(JSON.stringify(strategy, null, 2));
}

runTest().catch(console.error);
