/**
 * Pipeline Orchestrator
 * 
 * This is the MAIN entry point for the multi-agent poker coach.
 * It coordinates all 7 agents and handles:
 * 
 * 1. Transforming incoming data from route.ts to agent input format
 * 2. Running agents in the correct order (with parallel execution)
 * 3. Handling errors with fallback to old single-prompt method
 * 4. Formatting the final output
 * 
 * DATA FLOW:
 * 
 *   route.ts receives body.parsed (from worker.py)
 *        ↓
 *   pipeline.transformToAgentInput()
 *        ↓
 *   Agent 0 (Board) → Tier 1
 *        ↓
 *   Agent 1 (Ranges) + Agent 4 (SPR) → Tier 2 (Parallel)
 *        ↓
 *   Agent 2 (Equity) + Agent 3 (Advantages) → Tier 3 (Parallel)
 *        ↓
 *   Agent 5 (GTO Strategy) → Tier 4
 *        ↓
 *   Agent 6 (Mistake Detector) → Tier 5
 *        ↓
 *   formatOutput() → Final response
 */

import { agent0_boardAnalyzer } from '../agents/agent0_boardAnalyzer';
import { agent1_rangeBuilder } from '../agents/agent1_rangeBuilder';
import { agent2_equityCalculator } from '../agents/agent2_equityCalculator';
import { agent3_advantageAnalyzer } from '../agents/agent3_advantageAnalyzer';
import { agent4_sprCalculator } from '../agents/agent4_sprCalculator';
import { agent5_gtoStrategy } from '../agents/agent5_gtoStrategy';
import { agent6_mistakeDetector } from '../agents/agent6_mistakeDetector';

import {
    HandInput,
    Action,
    HeroActions,
    CoachOutput,
    Street,
    ActionType,
    PotSizes,
    Stacks
} from '../types/agentContracts';

// ═══════════════════════════════════════════════════════════════
// DATA TRANSFORMER: Convert route.ts data to agent input format
// ═══════════════════════════════════════════════════════════════

/**
 * Determine which streets Hero actually saw
 * Based on which streets have hero actions recorded
 * CRITICAL: If hero folded, they didn't see subsequent streets!
 */
function determineStreetsPlayed(heroActions: HeroActions): {
    preflop: boolean;
    flop: boolean;
    turn: boolean;
    river: boolean;
} {
    // Check if hero folded on any street
    const foldedPreflop = heroActions.preflop?.first?.action === 'fold' || heroActions.preflop?.second?.action === 'fold';
    const foldedOnFlop = heroActions.flop?.first?.action === 'fold' || heroActions.flop?.second?.action === 'fold';
    const foldedOnTurn = heroActions.turn?.first?.action === 'fold' || heroActions.turn?.second?.action === 'fold';

    return {
        preflop: true, // Always saw preflop - got cards
        flop: !foldedPreflop && !!heroActions.flop,  // Saw flop only if didn't fold preflop
        turn: !foldedPreflop && !foldedOnFlop && !!heroActions.turn,  // Saw turn only if didn't fold earlier
        river: !foldedPreflop && !foldedOnFlop && !foldedOnTurn && !!heroActions.river  // Saw river only if didn't fold earlier
    };
}

/**
 * Convert card notation from PokerStars format to display format
 * "Kh" → "K♥", "As" → "A♠"
 */
function convertCardToDisplay(card: string): string {
    if (!card || card.length < 2) return card;

    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();

    const suitMap: Record<string, string> = {
        'h': '♥', 's': '♠', 'd': '♦', 'c': '♣'
    };

    return `${rank}${suitMap[suit] || suit}`;
}

/**
 * Convert board string from "Ks 9d 5c As 2c" to "K♠ 9♦ 5♣ A♠ 2♣"
 */
function convertBoardToDisplay(board: string): string {
    if (!board) return '';

    const cards = board.trim().split(/\s+/);
    return cards.map(convertCardToDisplay).join(' ');
}

/**
 * Convert hero cards from "Kh Th" to "K♥T♥"
 */
function convertCardsToDisplay(cards: string): string {
    if (!cards) return '';

    const cardList = cards.trim().split(/\s+/);
    return cardList.map(convertCardToDisplay).join('');
}

/**
 * Extract villain position from raw hand text
 * Looks for patterns like "BTN: calls" or "Seat 3 (BTN)"
 */
function extractVillainPosition(rawText: string, heroPosition: string): string {
    const positions = ['UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    const text = rawText.toUpperCase();

    // Find positions that appear in the text (excluding hero)
    for (const pos of positions) {
        if (pos !== heroPosition.toUpperCase() && text.includes(pos)) {
            // Check if this position has actions (not just sitting out)
            const posRegex = new RegExp(`${pos}[:\\s]*(calls?|raises?|bets?|folds?|checks?)`, 'i');
            if (posRegex.test(rawText)) {
                return pos;
            }
        }
    }

    // Default to BTN if we can't find villain
    return heroPosition === 'BTN' ? 'BB' : 'BTN';
}

/**
 * Parse actions from raw hand text
 * Extracts betting actions for each street
 */
function parseActionsFromRaw(rawText: string): Action[] {
    const actions: Action[] = [];

    // CRITICAL FIX: Extract hero's name from "Dealt to [NAME]" line
    const dealtToMatch = rawText.match(/Dealt to ([^\s\[]+)/i);
    const heroName = dealtToMatch ? dealtToMatch[1].toLowerCase() : null;

    if (!heroName) {
        console.warn('[parseActions] Could not find hero name in hand history');
        return []; // Return empty instead of fake defaults
    }

    console.log(`[parseActions] Hero identified as: ${heroName}`);

    // Helper to detect street sections
    const streetPatterns: Record<Street, RegExp> = {
        preflop: /\*\*\* hole cards \*\*\*/i,
        flop: /\*\*\* flop \*\*\*/i,
        turn: /\*\*\* turn \*\*\*/i,
        river: /\*\*\* river \*\*\*/i
    };

    let currentStreet: Street = 'preflop';
    const lines = rawText.split('\n');

    for (const line of lines) {
        // Check for street change
        if (streetPatterns.flop.test(line)) currentStreet = 'flop';
        else if (streetPatterns.turn.test(line)) currentStreet = 'turn';
        else if (streetPatterns.river.test(line)) currentStreet = 'river';

        // Parse actions: "[PlayerName] [action] [amount]"
        // Examples: "KannyThOP folds", "Hellliga raises $0.75 to $0.75"
        const actionMatch = line.match(/^([A-Za-z0-9_]+)\s+(folds?|checks?|calls?|bets?|raises?)(?:\s+\$?([\d.]+))?/i);

        if (actionMatch) {
            const playerNameFromLine = actionMatch[1].toLowerCase();
            const actionRaw = actionMatch[2].toLowerCase();
            const amount = actionMatch[3] ? parseFloat(actionMatch[3]) : undefined;

            // Check if this is the hero
            const isHero = playerNameFromLine === heroName;

            // Map action string to ActionType
            let action: ActionType;
            if (actionRaw.includes('fold')) action = 'fold';
            else if (actionRaw.includes('check')) action = 'check';
            else if (actionRaw.includes('call')) action = 'call';
            else if (actionRaw.includes('bet')) action = 'bet';
            else if (actionRaw.includes('raise')) action = 'raise';
            else continue;

            actions.push({
                street: currentStreet,
                player: isHero ? 'hero' : 'villain',
                action,
                amount
            });

            console.log(`[parseActions] ${currentStreet}: ${isHero ? 'HERO' : 'villain'} ${action}${amount ? ` $${amount}` : ''}`);
        }
    }

    console.log(`[parseActions] Parsed ${actions.length} total actions`);
    return actions;
}

/**
 * Extract hero's actual actions per street for mistake detection
 * Now tracks BOTH first and second actions per street
 */
function extractHeroActions(actions: Action[]): HeroActions {
    const heroActions: HeroActions = {};

    // Initialize street structures
    const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
    for (const street of streets) {
        heroActions[street] = {};
    }

    // Populate first and second actions per street
    for (const action of actions) {
        if (action.player === 'hero') {
            const streetActions = heroActions[action.street];
            if (streetActions) {
                if (!streetActions.first) {
                    // First action on this street
                    streetActions.first = {
                        action: action.action,
                        amount: action.amount
                    };
                } else if (!streetActions.second) {
                    // Second action on this street (response to villain)
                    streetActions.second = {
                        action: action.action,
                        amount: action.amount
                    };
                }
                // Ignore third+ actions (rare)
            }
        }
    }

    // Clean up empty streets
    for (const street of streets) {
        if (!heroActions[street]?.first) {
            delete heroActions[street];
        }
    }

    return heroActions;
}

/**
 * Estimate pot sizes per street from actions
 * This is a rough estimate - could be improved with more parsing
 */
function estimatePotSizes(actions: Action[]): PotSizes {
    const potSizes: PotSizes = {};
    let runningPot = 1.5; // Typical blinds

    let currentStreet: Street = 'preflop';

    for (const action of actions) {
        if (action.street !== currentStreet) {
            // Save pot for previous street
            potSizes[currentStreet] = runningPot;
            currentStreet = action.street;
        }

        // Add to pot based on action
        if (action.amount) {
            runningPot += action.amount;
        }
    }

    // Save final street pot
    potSizes[currentStreet] = runningPot;

    return potSizes;
}

/**
 * Map replayer action names to our ActionType
 */
function mapReplayerAction(action: string): ActionType {
    const map: Record<string, ActionType> = {
        'folds': 'fold',
        'checks': 'check',
        'calls': 'call',
        'bets': 'bet',
        'raises': 'raise',
        'raiseTo': 'raise'
    };
    return map[action] || 'check';
}

/**
 * Convert replayer_data actions to our Action[] format
 */
function convertReplayerActions(replayerData: any): Action[] {
    const heroName = replayerData.players.find((p: any) => p.isHero)?.name;

    if (!heroName) {
        console.warn('[convertReplayerActions] Could not find hero in players');
        return [];
    }

    return replayerData.actions.map((a: any) => ({
        street: a.street as Street,
        player: a.player === heroName ? 'hero' : 'villain',
        action: mapReplayerAction(a.action),
        amount: a.amount || undefined
    }));
}

/**
 * Main transformer: Convert route.ts body to HandInput
 * NOW USES PRE-PARSED REPLAYER_DATA instead of manual parsing!
 */
export function transformToAgentInput(body: any): HandInput {
    const replayerData = body.replayer_data;

    if (!replayerData) {
        console.error('[transformToAgentInput] Missing replayer_data - hand not properly migrated');
        throw new Error('Missing replayer_data - please re-run migrate_hands.py');
    }

    // Get hero player
    const hero = replayerData.players.find((p: any) => p.isHero);
    if (!hero) {
        console.error('[transformToAgentInput] Could not identify hero in replayer_data');
        throw new Error('Could not identify hero in players array');
    }

    // Get villain (the preflop raiser, or first non-hero with actions)
    let villainName = replayerData.actions.find((a: any) =>
        a.player !== hero.name &&
        a.street === 'preflop' &&
        (a.action === 'raises' || a.action === 'raiseTo')
    )?.player;

    // Fallback: if no raiser found, use first non-hero player with actions
    if (!villainName) {
        villainName = replayerData.actions.find((a: any) => a.player !== hero.name)?.player;
    }

    const villain = replayerData.players.find((p: any) => p.name === villainName);

    // Convert board from ["3♦", "4♥", "3♣"] to "3♦ 4♥ 3♣"
    const board = replayerData.board?.join(' ') || '';

    // Convert actions from replayer format to agent format
    const actions = convertReplayerActions(replayerData);
    const heroActions = extractHeroActions(actions);

    // Calculate pot sizes from actions
    const potSizes = estimatePotSizes(actions);

    // Get last bet amount
    const lastBet = replayerData.actions[replayerData.actions.length - 1]?.amount || 0;

    console.log(`[transformToAgentInput] ✅ Using replayer_data`);
    console.log(`[transformToAgentInput] Hero: ${hero.name} (${hero.position}) with ${hero.cards?.join('') || 'unknown'}`);
    console.log(`[transformToAgentInput] Board: ${board || 'None'}`);
    console.log(`[transformToAgentInput] Actions: ${actions.length} parsed`);

    return {
        handId: body.hand_id || body.id || 'unknown',
        cards: hero.cards?.join('') || '',
        board,
        positions: {
            hero: hero.position || 'BTN',
            villain: villain?.position || 'BB'
        },
        actions,
        heroActions,
        stacks: {
            hero: hero.stack || 100,
            villain: villain?.stack || 100
        },
        potSizes,
        lastBet
    };
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR: Run all agents in order
// ═══════════════════════════════════════════════════════════════

/**
 * Run the full multi-agent pipeline
 * 
 * @param input - HandInput from transformToAgentInput()
 * @returns CoachOutput - Final formatted result
 */
export async function runMultiAgentPipeline(input: HandInput): Promise<CoachOutput> {
    const startTime = Date.now();
    console.log('[Pipeline] Starting multi-agent analysis...');
    console.log(`[Pipeline] Hand: ${input.cards} on ${input.board}`);

    try {
        // ═══════════════════════════════════════════════════════════
        // STREET FILTERING: Determine which streets Hero actually saw
        // ═══════════════════════════════════════════════════════════
        const streetsPlayed = determineStreetsPlayed(input.heroActions);
        console.log('[Pipeline] 🔍 DEBUG - Hero Actions:', JSON.stringify(input.heroActions, null, 2));
        console.log('[Pipeline] 🔍 DEBUG - Streets Played:', JSON.stringify(streetsPlayed, null, 2));

        // ═══════════════════════════════════════════════════════════
        // TIER 1: Board Analysis (Foundation)
        // ═══════════════════════════════════════════════════════════
        console.log('[Pipeline] Tier 1: Board Analyzer...');

        let boardAnalysis;

        // CRITICAL FIX: Only analyze board if Hero saw postflop
        if (!streetsPlayed.flop) {
            console.log('[Pipeline] Hero did not see flop - skipping board analysis');
            boardAnalysis = {
                summary: {
                    is_paired: false,
                    flush_possible: false,
                    straight_possible: false,
                    high_cards: []
                }
            };
        } else {
            boardAnalysis = await agent0_boardAnalyzer({
                board: input.board
            });
        }

        // ═══════════════════════════════════════════════════════════
        // TIER 2: Ranges + SPR (Parallel Execution!)
        // ═══════════════════════════════════════════════════════════
        console.log('[Pipeline] Tier 2: Range Builder + SPR (parallel)...');
        const [ranges, spr] = await Promise.all([
            agent1_rangeBuilder({
                boardAnalysis,
                positions: input.positions,
                actions: input.actions
            }),
            Promise.resolve(agent4_sprCalculator({
                potSizes: input.potSizes,
                stacks: input.stacks
            }))
        ]);

        // ═══════════════════════════════════════════════════════════
        // TIER 3: Equity + Advantages (Parallel Execution!)
        // ═══════════════════════════════════════════════════════════
        console.log('[Pipeline] Tier 3: Equity + Advantages (parallel)...');

        // Get villain range for equity calculation
        const villainRange =
            ranges.river?.villain_range ||
            ranges.turn?.villain_range ||
            ranges.flop?.villain_range ||
            ranges.preflop.villain_range.description;

        // Get current pot and bet for pot odds
        const potSize = input.potSizes.river || input.potSizes.turn ||
            input.potSizes.flop || input.potSizes.preflop || 10;

        const [equity, advantages] = await Promise.all([
            agent2_equityCalculator({
                heroHand: input.cards,
                villainRange: villainRange,
                board: input.board,
                potSize: potSize,
                betSize: input.lastBet || 0
            }),
            agent3_advantageAnalyzer({
                boardAnalysis,
                ranges,
                heroHand: input.cards
            })
        ]);

        // ═══════════════════════════════════════════════════════════
        // TIER 4: GTO Strategy (Needs all context)
        // ═══════════════════════════════════════════════════════════
        console.log('[Pipeline] Tier 4: GTO Strategy...');
        const gtoStrategy = await agent5_gtoStrategy({
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            heroHand: input.cards,
            positions: input.positions,   // ADD: Pass positions
            actions: input.actions,        // ADD: Pass action history
            streetsPlayed                  // NEW: Pass which streets Hero saw
        });

        // ═══════════════════════════════════════════════════════════
        // TIER 5: Mistake Detection (Needs ALL context + hero actions)
        // ═══════════════════════════════════════════════════════════
        console.log('[Pipeline] Tier 5: Mistake Detector...');
        const mistakes = await agent6_mistakeDetector({
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            gtoStrategy,
            heroActions: input.heroActions,
            positions: input.positions     // ADD: Pass positions
        });

        // ═══════════════════════════════════════════════════════════
        // FORMAT OUTPUT
        // ═══════════════════════════════════════════════════════════
        const duration = Date.now() - startTime;
        console.log(`[Pipeline] Complete in ${(duration / 1000).toFixed(1)}s`);

        return formatOutput({
            gtoStrategy,
            mistakes,
            ranges,
            equity,
            advantages,
            boardAnalysis,
            rawBoard: input.board,         // ADD: Pass raw board as fallback
            positions: input.positions     // ADD: Pass positions
        });

    } catch (error) {
        console.error('[Pipeline] Error:', error);
        throw error; // Let caller handle fallback
    }
}

// ═══════════════════════════════════════════════════════════════
// OUTPUT FORMATTER: Create final response
// ═══════════════════════════════════════════════════════════════

interface FormatInput {
    gtoStrategy: any;
    mistakes: any;
    ranges: any;
    equity: any;
    advantages: any;
    boardAnalysis: any;
    rawBoard?: string;        // ADD: Fallback board string
    positions?: any;          // ADD: Hero/villain positions
}

/**
 * Format all agent outputs into the final CoachOutput
 * Now handles MixedActionRecommendation with primary/alternative
 */
function formatOutput(data: FormatInput): CoachOutput {
    const { gtoStrategy, mistakes, ranges, equity, advantages, boardAnalysis, rawBoard, positions } = data;

    // Helper to format a mixed action recommendation
    const formatMixedAction = (rec: any): string => {
        if (!rec) return 'N/A';
        if (rec.primary) {
            // New MixedActionRecommendation format
            let text = `${rec.primary.action}`;
            if (rec.primary.sizing) text += ` (${rec.primary.sizing})`;
            if (rec.primary.frequency) text += ` [${(rec.primary.frequency * 100).toFixed(0)}%]`;
            if (rec.alternative) {
                text += ` / ${rec.alternative.action}`;
                if (rec.alternative.frequency) text += ` [${(rec.alternative.frequency * 100).toFixed(0)}%]`;
            }
            return text;
        }
        // Legacy format
        return rec.action || 'N/A';
    };

    const formatMixedReasoning = (rec: any): string => {
        if (!rec) return '';
        if (rec.primary?.reasoning) return rec.primary.reasoning;
        return rec.reasoning || '';
    };

    // Build GTO Strategy text with mixed strategy format
    let gtoText = '**GTO ANALYSIS (Mixed Strategy):**\n\n';

    // ADD: Situation header with positions
    if (positions) {
        gtoText += `**SITUATION:** Hero (${positions.hero}) vs Villain (${positions.villain})\n\n`;
    }

    // Parse rawBoard into flop/turn/river if needed
    const boardCards = (rawBoard || '').split(' ').filter(c => c.length > 0);
    const flopCards = boardCards.slice(0, 3).join(' ') || 'N/A';
    const turnCard = boardCards[3] || '';
    const riverCard = boardCards[4] || '';

    // Preflop (simple ActionRecommendation)
    if (gtoStrategy.preflop) {
        gtoText += `**PREFLOP:** ${gtoStrategy.preflop.action}`;
        if (gtoStrategy.preflop.sizing) gtoText += ` (${gtoStrategy.preflop.sizing})`;
        gtoText += `\n${gtoStrategy.preflop.reasoning || ''}\n\n`;
    }

    // Flop - Position-aware formatting
    if (gtoStrategy.flop) {
        const flop = gtoStrategy.flop;
        const flopDisplay = boardAnalysis.flop?.cards || flopCards;
        gtoText += `**FLOP (${flopDisplay}):**\n`;

        // Check if hero is in position (villain acts first) or out of position (hero acts first)
        const isIP = positions && !['SB', 'BB'].includes(positions.hero.toUpperCase());

        if (isIP) {
            // IN POSITION - Villain acts first
            if (flop.if_villain_checks) {
                gtoText += `  If villain checks: ${formatMixedAction(flop.if_villain_checks)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(flop.if_villain_checks)}\n`;
            }
            if (flop.if_villain_bets) {
                gtoText += `  If villain bets: ${formatMixedAction(flop.if_villain_bets)}\n`;
            }
            if (flop.if_hero_bets_and_villain_raises) {
                gtoText += `  If hero bets → villain raises: ${formatMixedAction(flop.if_hero_bets_and_villain_raises)}\n`;
            }
        } else {
            // OUT OF POSITION - Hero acts first
            if (flop.initial_action) {
                gtoText += `  Initial: ${formatMixedAction(flop.initial_action)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(flop.initial_action)}\n`;
            }
            if (flop.if_check_and_villain_bets) {
                gtoText += `  If check → villain bets: ${formatMixedAction(flop.if_check_and_villain_bets)}\n`;
            }
            if (flop.if_bet_and_villain_raises) {
                gtoText += `  If bet → villain raises: ${formatMixedAction(flop.if_bet_and_villain_raises)}\n`;
            }
        }
        gtoText += '\n';
    }

    // Turn - Position-aware formatting
    if (gtoStrategy.turn) {
        const turn = gtoStrategy.turn;
        const turnDisplay = boardAnalysis.turn?.card || turnCard;
        gtoText += `**TURN (+${turnDisplay}):**\n`;

        const isIP = positions && !['SB', 'BB'].includes(positions.hero.toUpperCase());

        if (isIP) {
            // IN POSITION
            if (turn.if_villain_checks) {
                gtoText += `  If villain checks: ${formatMixedAction(turn.if_villain_checks)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(turn.if_villain_checks)}\n`;
            }
            if (turn.if_villain_bets) {
                gtoText += `  If villain bets: ${formatMixedAction(turn.if_villain_bets)}\n`;
            }
            if (turn.if_hero_bets_and_villain_raises) {
                gtoText += `  If hero bets → villain raises: ${formatMixedAction(turn.if_hero_bets_and_villain_raises)}\n`;
            }
        } else {
            // OUT OF POSITION
            if (turn.initial_action) {
                gtoText += `  Initial: ${formatMixedAction(turn.initial_action)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(turn.initial_action)}\n`;
            }
            if (turn.if_check_and_villain_bets) {
                gtoText += `  If check → villain bets: ${formatMixedAction(turn.if_check_and_villain_bets)}\n`;
            }
            if (turn.if_bet_and_villain_raises) {
                gtoText += `  If bet → villain raises: ${formatMixedAction(turn.if_bet_and_villain_raises)}\n`;
            }
        }
        gtoText += '\n';
    }

    // River - Position-aware formatting
    if (gtoStrategy.river) {
        const river = gtoStrategy.river;
        const riverDisplay = boardAnalysis.river?.card || riverCard;
        gtoText += `**RIVER (+${riverDisplay}):**\n`;

        const isIP = positions && !['SB', 'BB'].includes(positions.hero.toUpperCase());

        if (isIP) {
            // IN POSITION
            if (river.if_villain_checks) {
                gtoText += `  If villain checks: ${formatMixedAction(river.if_villain_checks)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(river.if_villain_checks)}\n`;
            }
            if (river.if_villain_bets) {
                gtoText += `  If villain bets: ${formatMixedAction(river.if_villain_bets)}\n`;
            }
            if (river.if_hero_bets_and_villain_raises) {
                gtoText += `  If hero bets → villain raises: ${formatMixedAction(river.if_hero_bets_and_villain_raises)}\n`;
            }
        } else {
            // OUT OF POSITION
            if (river.initial_action) {
                gtoText += `  Initial: ${formatMixedAction(river.initial_action)}`;
                gtoText += `\n    └─ ${formatMixedReasoning(river.initial_action)}\n`;
            }
            if (river.if_check_and_villain_bets) {
                gtoText += `  If check → villain bets: ${formatMixedAction(river.if_check_and_villain_bets)}\n`;
            }
            if (river.if_bet_and_villain_raises) {
                gtoText += `  If bet → villain raises: ${formatMixedAction(river.if_bet_and_villain_raises)}\n`;
            }
        }
        gtoText += '\n';
    }

    // Add equity info
    gtoText += `**EQUITY:** ${(equity.equity_vs_range * 100).toFixed(1)}% vs villain's range\n`;
    gtoText += `**POT ODDS:** ${(equity.pot_odds.equity_needed * 100).toFixed(1)}% needed\n`;

    // Build Play Classification text (replaces deviation text)
    let classificationText = '';

    if (mistakes.summary) {
        const s = mistakes.summary;
        classificationText = '**PLAY CLASSIFICATION:**\n\n';
        classificationText += `🟢 Optimal: ${s.optimal_count || 0}\n`;
        classificationText += `🟡 Acceptable: ${s.acceptable_count || 0}\n`;
        classificationText += `🔴 Mistakes: ${s.mistake_count || 0}\n\n`;
        classificationText += `**Overall:** ${s.overall_assessment || 'N/A'}\n`;

        // List individual decisions
        if (mistakes.decisions && mistakes.decisions.length > 0) {
            classificationText += '\n**Decision Breakdown:**\n';
            for (const d of mistakes.decisions) {
                const emoji = d.play_quality === 'optimal' ? '🟢' :
                    d.play_quality === 'acceptable' ? '🟡' : '🔴';
                classificationText += `${emoji} ${(d.street || 'unknown').toUpperCase()} (${d.decision_point || 'action'}): `;
                classificationText += `${d.hero_action} → ${d.play_quality}\n`;
            }
        }
    } else if (mistakes.mistakes && mistakes.mistakes.length > 0) {
        // Fallback to old format
        classificationText = '**DEVIATIONS FROM GTO:**\n\n';
        for (const mistake of mistakes.mistakes) {
            const severity = mistake.severity ? mistake.severity.toUpperCase() : 'UNKNOWN';
            classificationText += `**${(mistake.street || 'UNKNOWN').toUpperCase()} - ${severity}:**\n`;
            classificationText += `${mistake.reasoning || ''}\n\n`;
        }
    } else {
        classificationText = '**PLAY CLASSIFICATION:**\n\n✅ All plays aligned with GTO recommendations.';
    }

    // Extract learning tags
    const learningTags: string[] = [];
    if (advantages.blocker_effects?.hero_blocks?.length > 0) {
        learningTags.push('blocker_effects');
    }
    if (mistakes.summary?.optimal_count && mistakes.summary.optimal_count > 0) {
        learningTags.push('optimal_play');
    }
    if (mistakes.summary?.mistake_count && mistakes.summary.mistake_count > 0) {
        learningTags.push('needs_review');
    }
    if (advantages.flop?.range_advantage?.leader === 'hero') {
        learningTags.push('range_advantage');
    }

    return {
        gto_strategy: gtoText,
        exploit_deviation: classificationText,
        learning_tag: learningTags,
        structured_data: {
            mistakes: mistakes.mistakes || [],
            ranges,
            equity,
            advantages
        }
    };
}



// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export {
    convertCardToDisplay,
    convertBoardToDisplay,
    convertCardsToDisplay,
    extractVillainPosition,
    parseActionsFromRaw,
    extractHeroActions,
    estimatePotSizes
};
