
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
// NOTE: classifyHand now called within Agent 1 (Phase 12)

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

    // CRITICAL: Only analyze the action section, skip summary entirely
    // Split on "*** SUMMARY ***" and only use the part before it
    const actionText = rawText.split('***SUMMARY***')[0].split('*** SUMMARY ***')[0];

    // Priority 1: Find players who put money in (VPIP)
    // Match pattern like: "PlayerName (POS) calls" or "(POS) raises"
    for (const pos of positions) {
        if (pos === heroPosition.toUpperCase()) continue;

        // Look for active actions: calls, raises, bets
        // Use word boundary to ensure we match "calls" but not "recalls"
        const activePattern = new RegExp(`\\(${pos}\\)[^\\n]*\\b(calls?|raises?|bets?)\\b`, 'i');
        if (activePattern.test(actionText)) {
            return pos;
        }
    }

    // Priority 2: Find anyone who checked  
    for (const pos of positions) {
        if (pos === heroPosition.toUpperCase()) continue;
        const checkPattern = new RegExp(`\\(${pos}\\)[^\\n]*\\b(checks?)\\b`, 'i');
        if (checkPattern.test(actionText)) {
            return pos;
        }
    }

    // Priority 3: Position-based defaults
    // SB vs BB is the most common heads-up scenario when everyone folds
    if (heroPosition.toUpperCase() === 'SB') return 'BB';
    if (heroPosition.toUpperCase() === 'BTN') return 'BB';
    if (heroPosition.toUpperCase() === 'BB') return 'SB';

    // Absolute fallback
    return 'BB';
}

/**
 * Determine villain context based on action order
 * Option B: Use replayer_data.actions to check if Hero faced action BEFORE their decision
 * 
 * Returns:
 * - { type: 'opening', villain: null } - Hero is first to act (no villain at decision time)
 * - { type: 'sb_vs_bb', villain: 'BB' } - Hero in SB, always plays vs BB
 * - { type: 'facing_action', villain: position } - Hero faced a raise before their action
 */
interface VillainContext {
    type: 'opening' | 'sb_vs_bb' | 'facing_action';
    villain: string | null;
    villainName?: string;
}

function determineVillainContext(
    replayerData: any,
    heroPosition: string,
    heroName: string,
    rawText: string
): VillainContext {
    const actions = replayerData?.actions || [];

    console.error(`[VillainContext] Checking for heroName: "${heroName}", heroPosition: "${heroPosition}"`);
    console.error(`[VillainContext] Actions count: ${actions.length}`);

    // Find Hero's first preflop action
    const heroAction = actions.find((a: any) =>
        a.street === 'preflop' &&
        (a.player === heroName || a.isHero === true)
    );
    const heroActionIndex = actions.findIndex((a: any) =>
        a.street === 'preflop' &&
        (a.player === heroName || a.isHero === true)
    );

    console.error(`[VillainContext] Hero action index: ${heroActionIndex}, action: ${heroAction?.action}`);

    if (heroActionIndex === -1) {
        // Hero didn't act in preflop - use fallback
        console.error('[VillainContext] Hero action not found, using fallback');
        return {
            type: 'facing_action',
            villain: extractVillainPosition(rawText, heroPosition)
        };
    }

    // Check if any raise/bet happened BEFORE Hero's action
    const priorActions = actions.slice(0, heroActionIndex);
    const priorRaise = priorActions.find((a: any) =>
        a.street === 'preflop' &&
        ['raises', 'raise', 'raiseTo', 'raiseto', 'bets', 'bet'].includes(a.action?.toLowerCase?.() || a.action)
    );

    if (priorRaise) {
        // Hero faced action - find the raiser's position
        const raiserName = priorRaise.player;
        const players = replayerData?.players || [];
        const raiserInfo = players.find((p: any) => p.name === raiserName);
        const villainPos = raiserInfo?.position || extractVillainPosition(rawText, heroPosition);

        console.error(`[VillainContext] Hero faced raise from ${raiserName} (${villainPos})`);
        return {
            type: 'facing_action',
            villain: villainPos,
            villainName: raiserName
        };
    }

    // Special case: SB always plays vs BB 
    if (heroPosition.toUpperCase() === 'SB') {
        console.error('[VillainContext] Hero is SB - vs BB');
        return { type: 'sb_vs_bb', villain: 'BB' };
    }

    // Hero was first to act - now check if they FOLDED or RAISED
    const heroActionType = (heroAction?.action || '').toLowerCase();
    const heroFolded = heroActionType === 'folds' || heroActionType === 'fold';

    // Check if hand went to postflop (has flop/turn/river actions)
    const hasPostflopActions = actions.some((a: any) =>
        ['flop', 'turn', 'river'].includes(a.street)
    );

    console.error(`[VillainContext] Hero action: ${heroActionType}, folded: ${heroFolded}, hasPostflop: ${hasPostflopActions}`);

    if (heroFolded) {
        // Hero folded first - pure opening range analysis (no villain needed)
        console.error(`[VillainContext] Hero folded first at ${heroPosition} - opening scenario`);
        return { type: 'opening', villain: null };
    }

    if (hasPostflopActions) {
        // Hero raised AND hand went to flop - find who called/3-bet
        const postHeroActions = actions.slice(heroActionIndex + 1);

        // Find the caller or 3-bettor
        const callerAction = postHeroActions.find((a: any) =>
            a.street === 'preflop' &&
            a.player !== heroName &&
            ['calls', 'call', 'raises', 'raise', 'raiseTo', 'raiseto'].includes(a.action?.toLowerCase?.() || a.action)
        );

        if (callerAction) {
            const players = replayerData?.players || [];
            const callerInfo = players.find((p: any) => p.name === callerAction.player);
            const villainPos = callerInfo?.position || extractVillainPosition(rawText, heroPosition);

            console.error(`[VillainContext] Hero raised, ${callerAction.player} (${villainPos}) called/3-bet - facing action for postflop`);
            return {
                type: 'facing_action',
                villain: villainPos,
                villainName: callerAction.player
            };
        }
    }

    // Hero raised but hand didn't go to flop (everyone folded) - still opening analysis
    console.error(`[VillainContext] Hero raised first, no postflop - opening scenario`);
    return { type: 'opening', villain: null };
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

    console.error(`[parseActions] Hero identified as: ${heroName}`);

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

            console.error(`[parseActions] ${currentStreet}: ${isHero ? 'HERO' : 'villain'} ${action}${amount ? ` $${amount}` : ''}`);
        }
    }

    console.error(`[parseActions] Parsed ${actions.length} total actions`);
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

    // FIX: Allow body.parsed.position (dynamic fix) to override stale replayer_data position
    if (body.parsed?.position) {
        console.error(`[transformToAgentInput] Overriding hero position ${hero.position} with parsed position ${body.parsed.position}`);
        hero.position = body.parsed.position;
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

    // Calculate accurate "to call" amount
    // Logic: Find max committed by any villain - max committed by hero
    const currentStreet = actions[actions.length - 1]?.street || 'preflop';
    const streetActions = actions.filter(a => a.street === currentStreet);

    let maxVillainCommit = 0;
    let maxHeroCommit = 0;

    for (const action of streetActions) {
        if (action.amount) {
            if (action.player === 'hero') {
                maxHeroCommit = Math.max(maxHeroCommit, action.amount);
            } else {
                maxVillainCommit = Math.max(maxVillainCommit, action.amount);
            }
        }
    }

    // If hero folded, we want to know what they faced BEFORE folding
    // The loop above naturally captures the high water mark of bets
    const toCall = Math.max(0, maxVillainCommit - maxHeroCommit);

    console.error(`[transformToAgentInput] Pot Odds Calc: Vil=$${maxVillainCommit}, Hero=$${maxHeroCommit} => ToCall=$${toCall}`);

    // Map to lastBet for compatibility
    const lastBet = toCall;

    console.error(`[transformToAgentInput] ✅ Using replayer_data`);
    console.error(`[transformToAgentInput] Hero: ${hero.name} (${hero.position}) with ${hero.cards?.join('') || 'unknown'}`);
    console.error(`[transformToAgentInput] Board: ${board || 'None'}`);
    console.error(`[transformToAgentInput] Actions: ${actions.length} parsed`);

    // Calculate table size (number of players in replayer data)
    // Calculate table size for agent inferences  
    const tableSize = replayerData.players?.length || 6;

    // Determine villain context based on action order (Option B)
    // This checks if Hero faced action BEFORE their decision
    const villainContext = determineVillainContext(
        replayerData,
        hero.position || 'BTN',
        hero.name || 'Hero',
        body.raw_text || ''
    );

    // Use extracted villain position, fallback to old method if no context
    const villainPosition = villainContext.villain || extractVillainPosition(body.raw_text || '', hero.position || 'BTN');

    return {
        handId: body.hand_id || body.id || 'unknown',
        cards: hero.cards?.join('') || '',
        board,
        positions: {
            hero: hero.position || 'BTN',
            villain: villainPosition  // Use extracted position (now respects action order)
        },
        actions,
        heroActions,
        stacks: {
            hero: hero.stack || 100,
            villain: villain?.stack || 100
        },
        potSizes,
        lastBet,
        tableSize,
        villainContext: {  // Expose context type to agents
            type: villainContext.type,
            villainName: villainContext.villainName
        }
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
    console.error('[Pipeline] Starting multi-agent analysis...');
    console.error(`[Pipeline] Hand: ${input.cards} on ${input.board}`);

    try {
        // ═══════════════════════════════════════════════════════════
        // STREET FILTERING: Determine which streets Hero actually saw
        // ═══════════════════════════════════════════════════════════
        const streetsPlayed = determineStreetsPlayed(input.heroActions);
        console.error('[Pipeline] 🔍 DEBUG - Hero Actions:', JSON.stringify(input.heroActions, null, 2));
        console.error('[Pipeline] 🔍 DEBUG - Streets Played:', JSON.stringify(streetsPlayed, null, 2));

        // ═══════════════════════════════════════════════════════════
        // TIER 1: Board Analysis (Foundation)
        // ═══════════════════════════════════════════════════════════
        console.error('[Pipeline] Tier 1: Board Analyzer...');

        let boardAnalysis;

        // CRITICAL FIX: Only analyze board if Hero saw postflop
        if (!streetsPlayed.flop) {
            console.error('[Pipeline] Hero did not see flop - skipping board analysis');
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
        // ═══════════════════════════════════════════════════════════
        console.error('[Pipeline] Tier 2: Range Builder + SPR (parallel)...');

        // Phase 12: Agent 1 now returns {ranges, heroClassification}
        const [agent1Output, spr] = await Promise.all([
            agent1_rangeBuilder({
                boardAnalysis,
                positions: input.positions,
                actions: input.actions,
                tableSize: input.tableSize,
                stacks: input.stacks   // NEW: Pass stacks for Phase 8 range filtering
            }),
            Promise.resolve(agent4_sprCalculator({
                potSizes: input.potSizes,
                stacks: input.stacks
            }))
        ]);

        // Extract ranges and heroClassification from Agent 1's unified output
        const ranges = agent1Output.ranges;
        const heroClassification = agent1Output.heroClassification;
        console.error(`[Pipeline] Hero Classification: ${heroClassification.bucket2D} (${heroClassification.tier}) - ${heroClassification.description}`);

        // ═══════════════════════════════════════════════════════════
        // TIER 3: Equity + Advantages (Parallel Execution!)
        // ═══════════════════════════════════════════════════════════
        console.error('[Pipeline] Tier 3: Equity + Advantages (parallel)...');

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
        console.error('[Pipeline] Tier 4: GTO Strategy...');
        const gtoStrategy = await agent5_gtoStrategy({
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            heroHand: input.cards,
            positions: input.positions,   // ADD: Pass positions
            actions: input.actions,        // ADD: Pass action history
            streetsPlayed,                 // NEW: Pass which streets Hero saw
            villainContext: input.villainContext,  // NEW: Pass villain context (opening vs facing action)
            heroClassification             // Phase 12: Unified classification from Agent 1
        });

        // ═══════════════════════════════════════════════════════════
        // TIER 5: Mistake Detection (Needs ALL context + hero actions)
        // ═══════════════════════════════════════════════════════════
        console.error('[Pipeline] Tier 5: Mistake Detector...');
        const mistakes = await agent6_mistakeDetector({
            boardAnalysis,
            ranges,
            equity,
            advantages,
            spr,
            gtoStrategy,
            heroActions: input.heroActions,
            positions: input.positions,
            heroClassification             // Phase 14: Pass hero classification for context
        });



        // ═══════════════════════════════════════════════════════════
        // FORMAT OUTPUT
        // ═══════════════════════════════════════════════════════════
        const duration = Date.now() - startTime;
        console.error(`[Pipeline] Complete in ${(duration / 1000).toFixed(1)}s`);

        return formatOutput({
            gtoStrategy,
            mistakes,
            ranges,
            equity,
            advantages,
            boardAnalysis,
            spr,                           // Phase 13/13.5: SPR analysis
            heroClassification,            // Phase 12: Hero classification
            rawBoard: input.board,
            positions: input.positions,
            actions: input.actions,
            villainContext: input.villainContext
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
    spr?: any;                    // Phase 13/13.5
    heroClassification?: any;     // Phase 12
    rawBoard?: string;
    positions?: any;              // Position type
    actions?: any[];
    villainContext?: {
        type: 'opening' | 'sb_vs_bb' | 'facing_action';
        villainName?: string;
    };
}

/**
 * Helper: Detect if a 3-bet or 4-bet actually occurred in the hand
 * Returns { has3Bet: boolean, has4Bet: boolean }
 */
function detectBettingAction(actions: Action[]): { has3Bet: boolean; has4Bet: boolean } {
    // Count preflop raises to determine 3-bet/4-bet
    const preflopActions = actions.filter(a => a.street === 'preflop');
    const raises = preflopActions.filter(a => a.action === 'raise');

    // 1st raise = open, 2nd raise = 3-bet, 3rd raise = 4-bet
    const has3Bet = raises.length >= 2;
    const has4Bet = raises.length >= 3;

    return { has3Bet, has4Bet };
}

/**
 * Determine position advantage based on hero/villain positions
 * Returns descriptive text for factual accuracy
 */
function determinePositionAdvantage(heroPos: string, villainPos: string): string {
    const hero = heroPos.toUpperCase();
    const villain = villainPos.toUpperCase();
    const blinds = ['SB', 'BB'];

    if (blinds.includes(hero) && !blinds.includes(villain)) {
        return 'out of position (blind vs non-blind)';
    } else if (!blinds.includes(hero) && blinds.includes(villain)) {
        return 'in position (non-blind vs blind)';
    } else if (hero === 'BTN') {
        return 'in position (button has positional advantage)';
    } else if (villain === 'BTN') {
        return 'out of position (vs button)';
    }
    return 'with relative position';
}

/**
 * Post-process filter: Remove contradictory position phrases
 * Ensures LLM cannot hallucinate incorrect position statements
 */
function correctPositionHallucinations(
    text: string,
    heroPos: string,
    villainPos: string,
    villainContext?: { type: 'opening' | 'sb_vs_bb' | 'facing_action'; villainName?: string }
): string {
    // For OPENING scenarios from late position, Hero is IN POSITION against blinds
    if (villainContext?.type === 'opening') {
        const latePositions = ['BTN', 'CO', 'HJ'];
        if (latePositions.includes(heroPos.toUpperCase())) {
            // Hero is ALWAYS in position against blinds when opening from late position
            // Remove incorrect "out of position" reasoning - it makes sentences illogical

            // Pattern: "to avoid playing a weak hand out of position" → remove the OOP reasoning
            text = text.replace(/\bto avoid playing a weak hand out of position\b/gi,
                'despite having positional advantage');

            // Pattern: "out of position against the blinds" → fix entire phrase
            text = text.replace(/\bout of position against the blinds\b/gi,
                'from this position (despite positional advantage over blinds)');

            // Pattern: "especially when out of position..." → remove entirely  
            text = text.replace(/,?\s*especially when out of position[^.]*\./gi, '.');

            // Pattern: "being out of position" → remove entire phrase (avoids "being makes it worse")
            text = text.replace(/\bbeing out of position\b/gi, 'having limited hand strength');

            // Pattern: "positional disadvantage" → flip to advantage
            text = text.replace(/\bpositional disadvantage\b/gi, 'positional advantage');

            // Pattern: "OOP" → "IP"
            text = text.replace(/\bOOP\b/g, 'IP');

            // Generic "out of position" as last resort → remove phrase
            text = text.replace(/\bout of position\b/gi, 'in position');

            // Clean up double spaces and awkward punctuation
            text = text.replace(/\s{2,}/g, ' ');
            text = text.replace(/\s+\./g, '.');
            text = text.replace(/\s+,/g, ',');
        }
        return text;
    }

    // For non-opening scenarios, use determinePositionAdvantage as before
    const correctAdvantage = determinePositionAdvantage(heroPos, villainPos);
    const isInPosition = correctAdvantage.includes('in position');

    // List of phrases to replace
    if (isInPosition) {
        // Hero IS in position - remove "out of position" phrases
        text = text.replace(/\bout of position\b/gi, 'in position');
        text = text.replace(/\bpositional disadvantage\b/gi, 'positional advantage');
        text = text.replace(/\bOOP\b/g, 'IP');
    } else if (correctAdvantage.includes('out of position')) {
        // Hero IS out of position - remove "in position" phrases  
        text = text.replace(/\bin position\b/gi, 'out of position');
        text = text.replace(/\bpositional advantage\b/gi, 'positional disadvantage');
        text = text.replace(/\bIP\b/g, 'OOP');
    }

    return text;
}


/**
 * Format all agent outputs into the final CoachOutput
 * Now handles MixedActionRecommendation with primary/alternative
 */
function formatOutput(data: FormatInput): CoachOutput {
    const { gtoStrategy, mistakes, ranges, equity, advantages, boardAnalysis, rawBoard, positions, actions } = data;

    // Detect if 3-bet/4-bet actually occurred
    const { has3Bet, has4Bet } = detectBettingAction(actions || []);

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
    let gtoText = '';

    // ADD: Situation header with positions - respects villainContext (Option B)
    if (positions) {
        const villainContext = data.villainContext;
        if (villainContext?.type === 'opening') {
            // Hero was first to act - opening range analysis
            gtoText += `**SITUATION:** Hero (${positions.hero}) - Opening Range Analysis\n\n`;
        } else if (villainContext?.type === 'sb_vs_bb') {
            // SB vs BB scenario
            gtoText += `**SITUATION:** Hero (${positions.hero}) vs Villain (BB) - Blind vs Blind\n\n`;
        } else {
            // Hero faced action - use villain as normal
            gtoText += `**SITUATION:** Hero (${positions.hero}) vs Villain (${positions.villain})\n\n`;
        }
    }

    // Parse rawBoard into flop/turn/river if needed
    const boardCards = (rawBoard || '').split(' ').filter(c => c.length > 0);
    const flopCards = boardCards.slice(0, 3).join(' ') || 'N/A';
    const turnCard = boardCards[3] || '';
    const riverCard = boardCards[4] || '';

    // Preflop (simple ActionRecommendation)
    // Preflop (Decision Tree)
    if (gtoStrategy.preflop) {
        // Initial Action
        if (gtoStrategy.preflop.initial_action) {
            gtoText += `**PREFLOP (Initial):** ${formatMixedAction(gtoStrategy.preflop.initial_action)}`;
            gtoText += `\n└─ ${formatMixedReasoning(gtoStrategy.preflop.initial_action)}\n`;
        }

        // Response to 3-bet (only show if 3-bet actually occurred)
        if (gtoStrategy.preflop.response_to_3bet && has3Bet) {
            gtoText += `**PREFLOP (vs 3-bet):** ${formatMixedAction(gtoStrategy.preflop.response_to_3bet)}`;
            gtoText += `\n└─ ${formatMixedReasoning(gtoStrategy.preflop.response_to_3bet)}\n`;
        }

        // Response to 4-bet (only show if 4-bet actually occurred)
        if (gtoStrategy.preflop.response_to_4bet && has4Bet) {
            gtoText += `**PREFLOP (vs 4-bet):** ${formatMixedAction(gtoStrategy.preflop.response_to_4bet)}`;
            gtoText += `\n└─ ${formatMixedReasoning(gtoStrategy.preflop.response_to_4bet)}\n`;
        }
        gtoText += '\n';
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

    // Add equity info ONLY when relevant (facing action, not opening)
    // Equity/Pot Odds matter for CALLING decisions, not opening/folding first
    const villainContext = data.villainContext;
    const isFacingAction = villainContext?.type === 'facing_action' || villainContext?.type === 'sb_vs_bb';

    if (isFacingAction) {
        gtoText += `**EQUITY:** ${(equity.equity_vs_range * 100).toFixed(1)}% vs villain's range\n`;
        gtoText += `**POT ODDS:** ${(equity.pot_odds.equity_needed * 100).toFixed(1)}% needed\n`;
    }

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

    // Apply post-process filter to correct any position hallucinations
    const correctedGtoText = positions ? correctPositionHallucinations(gtoText, positions.hero, positions.villain, data.villainContext) : gtoText;

    return {
        gto_strategy: correctedGtoText,
        exploit_deviation: classificationText,
        // exploit_signals: null, // Removed as per new structure
        learning_tag: learningTags,
        structured_data: {
            mistakes: mistakes.mistakes || [],
            ranges,
            equity,
            advantages
        },
        // Phase 12-14.5: Enhanced coaching data
        heroClassification: ranges?.heroClassification || null,
        spr: data.spr || null, // Assuming spr is directly on data object
        mistakes: mistakes || null // Top-level mistakes array
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
