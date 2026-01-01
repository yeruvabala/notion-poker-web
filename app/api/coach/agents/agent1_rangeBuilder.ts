/**
 * Agent 1: Range Builder
 * 
 * PURPOSE: Build position-based ranges that narrow street-by-street
 * 
 * This agent constructs the starting ranges for both hero and villain
 * based on their positions, then narrows those ranges based on actions
 * taken on each street.
 * 
 * RUNS: Tier 2 (parallel with Agent 4)
 * NEEDS: Agent 0 output (board analysis)
 * MODEL: GPT-4o
 * TOOLS: RangeEngine (Algorithmic Range Construction)
 * TIME: ~800ms
 */

import OpenAI from 'openai';
import { Agent1Input, Agent1Output, RangeData, HeroClassification, BoardAnalysis, Action, Position } from '../types/agentContracts';
import { RangeEngine, Range, RangeStats, BucketCategory } from '../utils/RangeEngine';
import { getOpeningAction } from '../utils/gtoRanges';
import { classifyHand } from '../utils/HandClassifierNew';  // Phase 12

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for range building - comprehensive range knowledge
const RANGE_BUILDER_SYSTEM_PROMPT = `You are a poker range construction expert. Your job is to build accurate ranges based on positions and actions.
You will be provided with "CALCULATED RANGE DATA" from a solvency engine. You MUST use this data as the foundation of your response.

POSITION-BASED OPENING RANGES (6-max):
- UTG: 10-12% (22+, ATs+, KQs, AJo+, KQo)
- HJ: 14-16% (22+, A8s+, KTs+, QJs, ATo+, KJo+)
- CO: 20-25% (22+, A2s+, K6s+, Q8s+, J9s+, T9s, 98s, ATo+, KTo+, QJo)
- BTN: 35-45% (22+, A2s+, K2s+, Q4s+, J7s+, T7s+, 97s+, 87s, 76s, 65s, A2o+, K7o+, Q9o+, JTo)
- SB: 30-40% (similar to BTN but slightly tighter)
- BB: Defends 40-50% of hands when facing raise

Return JSON in this exact format:
{
  "preflop": {
    "hero_range": { "description": "string", "combos": number, "spectrum": "string" },
    "villain_range": { "description": "string", "combos": number, "spectrum": "string" }
  },
  "flop": {
    "hero_range": "narrowed range description",
    "villain_range": "narrowed range description",
    "range_notes": "explanation of how ranges changed based on texture and action"
  },
  "turn": { "hero_range": "...", "villain_range": "...", "range_notes": "..." },
  "river": { "hero_range": "...", "villain_range": "...", "range_notes": "..." }
}

RULES:
1. Use standard hand notation (AA, AKs, AKo, 22+, A2s+, etc.)
2. Consider board texture when narrowing (e.g., K-high board = keep Kx hands)
3. Be specific about combo counts when possible
4. Note when ranges become "capped" (no nuts possible)
5. Only include streets that have actions`;

/**
 * Format actions for the prompt
 */
function formatActionsForPrompt(actions: Action[]): string {
    const streetActions: Record<string, string[]> = {
        preflop: [], flop: [], turn: [], river: []
    };

    for (const action of actions) {
        const actionStr = action.amount
            ? `${action.player} ${action.action} $${action.amount}`
            : `${action.player} ${action.action}`;
        streetActions[action.street].push(actionStr);
    }

    let result = '';
    for (const [street, acts] of Object.entries(streetActions)) {
        if (acts.length > 0) {
            result += `${street.toUpperCase()}: ${acts.join(' → ')}\n`;
        }
    }
    return result.trim();
}

interface EngineResult {
    street: string;
    heroStats: RangeStats;
    villainStats: RangeStats;
    notes: string[];
}

/**
 * RUN THE RANGE ENGINE
 * Simulates the hand action to get precise range stats
 */
function runRangeSimulation(input: Agent1Input): Record<string, EngineResult> {
    const { positions, actions, boardAnalysis, stacks } = input;
    const results: Record<string, EngineResult> = {};

    // 1. Initialize Preflop
    let heroRange = RangeEngine.initializeRange(positions.hero, positions.hero, 'open'); // Default assumption, refined below
    let villainRange = RangeEngine.initializeRange(positions.villain, positions.villain, 'call_open');

    // Need to determine who opened to set initial ranges correctly
    // Simplified logic: Preflop Aggressor gets 'open' range, Caller gets 'call_open'
    // We would need to parse preflop actions strictly here. 
    // For MVP, we use the engine's default logic which handles this partially.

    const preflopActions = actions.filter(a => a.street === 'preflop');
    const heroOpened = preflopActions.some(a => a.player === positions.hero && a.action === 'raise');
    const villainOpened = preflopActions.some(a => a.player === positions.villain && a.action === 'raise');

    if (heroOpened) heroRange = RangeEngine.initializeRange(positions.hero, positions.hero, 'open');
    else heroRange = RangeEngine.initializeRange(positions.hero, positions.hero, 'call_open');

    if (villainOpened) villainRange = RangeEngine.initializeRange(positions.villain, positions.villain, 'open');
    else villainRange = RangeEngine.initializeRange(positions.villain, positions.villain, 'call_open');

    // PHASE 8: Stack Depth Logic
    if (stacks) {
        // Calculate Effective Stack in BB (assuming stack input is raw chips, we treat < 50 as Short)
        // Note: Ideally we norm to BB, but for MVP we use raw or provided scale.
        // If stacks are small (e.g. 25), treat as BB. If large (e.g. 2500), treat as chips -> BB?
        // Agent 4 treats them as provided. We will assume provided stacks are relevant units (BB or Chips).
        // If > 200, assume chips and we might lack blind info to convert.
        // Heuristic: If min stack < 50, apply Short Stack logic.

        const effectiveStack = Math.min(stacks.hero, stacks.villain);

        // Apply Stack Filter
        heroRange = RangeEngine.applyStackFilter(heroRange, effectiveStack);
        villainRange = RangeEngine.applyStackFilter(villainRange, effectiveStack);
    }

    // Apply Card Removal (Hero's cards are known, so Villain can't have them)
    // We don't have Hero's specific cards in Agent1Input usually? 
    // Input usually has `feature_vector` or similar. If we don't have Hero cards, we skip removal.
    // Assuming Agent1Input might not have hero cards explicitly, we skip specific card removal for now.

    results['preflop'] = {
        street: 'preflop',
        heroStats: {
            ...RangeEngine.getStats(heroRange),
            allCombos: RangeEngine.getStats(heroRange).allCombos // Explicitly pass list
        },
        villainStats: {
            ...RangeEngine.getStats(villainRange),
            allCombos: RangeEngine.getStats(villainRange).allCombos
        },
        notes: [`Preflop: Hero ${heroOpened ? 'Aggressor' : 'Caller'}, Villain ${villainOpened ? 'Aggressor' : 'Caller'}`]
    };

    // 2. Flop
    if (boardAnalysis.flop) {
        const boardCards = boardAnalysis.flop.cards.split(' '); // "Ks 8h 2d" -> ["Ks", "8h", "2d"]

        // Categorize
        heroRange = RangeEngine.categorizeRange(heroRange, boardCards);
        villainRange = RangeEngine.categorizeRange(villainRange, boardCards);

        // Filter based on Flop actions
        const flopActions = actions.filter(a => a.street === 'flop');
        for (const act of flopActions) {
            const isAggressor = (act.player === positions.hero && heroOpened) || (act.player === positions.villain && villainOpened);

            if (act.player === positions.hero) {
                // Apply filter to Hero? 
                // We usually want to estimate Hero's PERCEIVED range. So yes, apply filters.
                heroRange = RangeEngine.applyActionFilter(heroRange, act.action as any, isAggressor, boardAnalysis.flop.cards);
            } else {
                villainRange = RangeEngine.applyActionFilter(villainRange, act.action as any, isAggressor, boardAnalysis.flop.cards);
            }
        }

        results['flop'] = {
            street: 'flop',
            heroStats: RangeEngine.getStats(heroRange),
            villainStats: RangeEngine.getStats(villainRange),
            notes: ["Flop ranges narrowed by action"]
        };
    }

    // 3. Turn
    if (boardAnalysis.turn) {
        const turnCard = boardAnalysis.turn.card;
        const boardCards = [...(boardAnalysis.flop?.cards.split(' ') || []), turnCard];

        heroRange = RangeEngine.categorizeRange(heroRange, boardCards); // Re-eval
        villainRange = RangeEngine.categorizeRange(villainRange, boardCards);

        const turnActions = actions.filter(a => a.street === 'turn');
        for (const act of turnActions) {
            const isAggressor = (act.player === positions.hero && heroOpened) || (act.player === positions.villain && villainOpened); // Simplified initiative tracking
            const boardStr = boardCards.join(' ');
            if (act.player === positions.hero) heroRange = RangeEngine.applyActionFilter(heroRange, act.action as any, isAggressor, boardStr);
            else villainRange = RangeEngine.applyActionFilter(villainRange, act.action as any, isAggressor, boardStr);
        }

        results['turn'] = {
            street: 'turn',
            heroStats: RangeEngine.getStats(heroRange),
            villainStats: RangeEngine.getStats(villainRange),
            notes: ["Turn re-evaluation complete"]
        };
    }

    // 4. River
    if (boardAnalysis.river) {
        const riverCard = boardAnalysis.river.card;
        const boardCards = [...(boardAnalysis.flop?.cards.split(' ') || []), boardAnalysis.turn?.card || '', riverCard];

        heroRange = RangeEngine.categorizeRange(heroRange, boardCards);
        villainRange = RangeEngine.categorizeRange(villainRange, boardCards);

        const riverActions = actions.filter(a => a.street === 'river');
        for (const act of riverActions) {
            const isAggressor = (act.player === positions.hero && heroOpened) || (act.player === positions.villain && villainOpened);
            const boardStr = boardCards.join(' ');
            if (act.player === positions.hero) heroRange = RangeEngine.applyActionFilter(heroRange, act.action as any, isAggressor, boardStr);
            else villainRange = RangeEngine.applyActionFilter(villainRange, act.action as any, isAggressor, boardStr);
        }

        results['river'] = {
            street: 'river',
            heroStats: RangeEngine.getStats(heroRange),
            villainStats: RangeEngine.getStats(villainRange),
            notes: ["River final ranges"]
        };
    }

    return results;
}

/**
 * Validates output structure
 */
function validateOutput(data: any): boolean {
    if (!data.preflop || !data.preflop.hero_range || !data.preflop.villain_range) return false;
    return true;
}

/**
 * Agent 1: Build Ranges
 */
export async function agent1_rangeBuilder(input: Agent1Input): Promise<Agent1Output> {
    const startTime = Date.now();
    const actionsFormatted = formatActionsForPrompt(input.actions);

    // 1. Run The Engine
    let engineData;
    let engineContext = '';
    try {
        engineData = runRangeSimulation(input);

        // Format Engine Data for LLM
        engineContext = "CALCULATED RANGE DATA (Use this as truth):\n";
        for (const [street, res] of Object.entries(engineData)) {
            engineContext += `\n[${street.toUpperCase()}]\n`;
            engineContext += `Hero Combos: ${res.heroStats.totalCombos.toFixed(1)}. Top: ${res.heroStats.topHands.slice(0, 5).join(',')}\n`;
            engineContext += `Hero Buckets: Monsters ${res.heroStats.distribution.monster.toFixed(0)}%, Strong ${res.heroStats.distribution.strong.toFixed(0)}%, Draws ${res.heroStats.distribution.draw_strong.toFixed(0)}%\n`;

            engineContext += `Villain Combos: ${res.villainStats.totalCombos.toFixed(1)}. Top: ${res.villainStats.topHands.slice(0, 5).join(',')}\n`;
            engineContext += `Villain Buckets: Monsters ${res.villainStats.distribution.monster.toFixed(0)}%, Strong ${res.villainStats.distribution.strong.toFixed(0)}%, Draws ${res.villainStats.distribution.draw_strong.toFixed(0)}%\n`;
        }
    } catch (e) {
        console.error("Range Engine failed:", e);
        engineContext = "Calculated data unavailable. Use standard GTO logic.";
    }

    // 2. Build Prompt
    let tableContext = '';
    if (input.tableSize && input.tableSize < 6) {
        tableContext = `TABLE SIZE: ${input.tableSize}-handed game. ADJUST RANGES LOOSER.`;
    }

    const userPrompt = `Build ranges for this poker hand:

${tableContext}

POSITIONS:
- Hero: ${input.positions.hero}
- Villain: ${input.positions.villain}

BOARD:
${input.boardAnalysis.flop ? `Flop: ${input.boardAnalysis.flop.cards} (${input.boardAnalysis.flop.texture})` : ''}
${input.boardAnalysis.turn ? `Turn: ${input.boardAnalysis.turn.card} (${input.boardAnalysis.turn.impact})` : ''}
${input.boardAnalysis.river ? `River: ${input.boardAnalysis.river.card}` : ''}

ACTIONS:
${actionsFormatted}

${engineContext}

Build accurate ranges for both players/streets.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: RANGE_BUILDER_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 1200,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from OpenAI');

        const ranges = JSON.parse(content) as RangeData;

        // Basic validation
        if (!validateOutput(ranges)) {
            // Fallback if structure is wrong
            return {
                ranges: createFallbackRanges(input.positions),
                heroClassification: {
                    bucket2D: "(0,0)",
                    tier: "AIR",
                    percentile: "Unknown",
                    description: "Fallback - validation failed",
                    interpretation: "Unable to classify"
                }
            };
        }

        // HYDRATE WITH ENGINE DATA (Phase 5)
        // Inject the detailed combo list from the engine into the LLM's structure
        if (engineData) {
            // Preflop - attach directly
            if (ranges.preflop?.villain_range) {
                ranges.preflop.villain_range.allCombos = engineData.preflop.villainStats.allCombos;
                ranges.preflop.villain_range.stats = engineData.preflop.villainStats; // Phase 6: Stats
            }
            if (ranges.preflop?.hero_range) {
                ranges.preflop.hero_range.allCombos = engineData.preflop.heroStats.allCombos;
                ranges.preflop.hero_range.stats = engineData.preflop.heroStats; // Phase 6: Stats
            }

            // Flop - Convert string to RangeInfo if needed
            if (ranges.flop && engineData.flop) {
                const flopDescVillain = typeof ranges.flop.villain_range === 'string' ? ranges.flop.villain_range : ranges.flop.villain_range.description;
                ranges.flop.villain_range = {
                    description: flopDescVillain,
                    combos: engineData.flop.villainStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.flop.villainStats.allCombos,
                    stats: engineData.flop.villainStats // Phase 6: Stats
                };

                const flopDescHero = typeof ranges.flop.hero_range === 'string' ? ranges.flop.hero_range : ranges.flop.hero_range.description;
                ranges.flop.hero_range = {
                    description: flopDescHero,
                    combos: engineData.flop.heroStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.flop.heroStats.allCombos,
                    stats: engineData.flop.heroStats // Phase 6: Stats
                };
            }

            // Turn
            if (ranges.turn && engineData.turn) {
                const turnDescVillain = typeof ranges.turn.villain_range === 'string' ? ranges.turn.villain_range : ranges.turn.villain_range.description;
                ranges.turn.villain_range = {
                    description: turnDescVillain,
                    combos: engineData.turn.villainStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.turn.villainStats.allCombos,
                    stats: engineData.turn.villainStats // Phase 6: Stats
                };

                const turnDescHero = typeof ranges.turn.hero_range === 'string' ? ranges.turn.hero_range : ranges.turn.hero_range.description;
                ranges.turn.hero_range = {
                    description: turnDescHero,
                    combos: engineData.turn.heroStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.turn.heroStats.allCombos,
                    stats: engineData.turn.heroStats // Phase 6: Stats
                };
            }

            // River
            if (ranges.river && engineData.river) {
                const riverDescVillain = typeof ranges.river.villain_range === 'string' ? ranges.river.villain_range : ranges.river.villain_range.description;
                ranges.river.villain_range = {
                    description: riverDescVillain,
                    combos: engineData.river.villainStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.river.villainStats.allCombos,
                    stats: engineData.river.villainStats // Phase 6: Stats
                };

                const riverDescHero = typeof ranges.river.hero_range === 'string' ? ranges.river.hero_range : ranges.river.hero_range.description;
                ranges.river.hero_range = {
                    description: riverDescHero,
                    combos: engineData.river.heroStats.totalCombos,
                    spectrum: 'Calculated',
                    allCombos: engineData.river.heroStats.allCombos,
                    stats: engineData.river.heroStats // Phase 6: Stats
                };
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[Agent 1: Range Builder] Completed in ${duration}ms`);

        // Phase 12: Classify Hero's hand and map to range tier
        const heroClassification = createHeroClassification(input, ranges, engineData);

        return {
            ranges,
            heroClassification
        };

    } catch (error) {
        console.error('[Agent 1: Range Builder] Error:', error);
        return {
            ranges: createFallbackRanges(input.positions),
            heroClassification: {
                bucket2D: "(0,0)",
                tier: "AIR",
                percentile: "Unknown",
                description: "Error - fallback used",
                interpretation: "Unable to classify"
            }
        };
    }
}

/**
 * Create fallback ranges if LLM call fails
 */
function createFallbackRanges(positions: Position): RangeData {
    const positionRanges: Record<string, { desc: string; combos: number; spectrum: string }> = {
        'UTG': { desc: '22+, ATs+, KQs, AJo+, KQo', combos: 156, spectrum: 'Top 10%' },
        'HJ': { desc: '22+, A8s+, KTs+, QJs, ATo+, KJo+', combos: 210, spectrum: 'Top 14%' },
        'CO': { desc: '22+, A2s+, K6s+, Q8s+, J9s+, ATo+, KTo+', combos: 300, spectrum: 'Top 22%' },
        'BTN': { desc: '22+, A2s+, K2s+, wide suited, ATo+', combos: 450, spectrum: 'Top 35%' },
        'SB': { desc: '22+, A2s+, K5s+, suited connectors', combos: 400, spectrum: 'Top 30%' },
        'BB': { desc: 'Defending vs raise: wide', combos: 500, spectrum: 'Top 40%' },
    };

    return {
        preflop: {
            hero_range: {
                description: positionRanges[positions.hero]?.desc || 'Top 20%',
                combos: positionRanges[positions.hero]?.combos || 300,
                spectrum: positionRanges[positions.hero]?.spectrum || 'Top 22%'
            },
            villain_range: {
                description: positionRanges[positions.villain]?.desc || 'Top 20%',
                combos: positionRanges[positions.villain]?.combos || 300,
                spectrum: positionRanges[positions.villain]?.spectrum || 'Top 35%'
            }
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// Phase 12: Hero Classification Helper Functions  
// ═══════════════════════════════════════════════════════════════

function mapBucketToTier(madeHand: number, drawStrength: number): string {
    if (madeHand >= 5) return "MONSTER";
    if (madeHand === 4) return "MONSTER";
    if (madeHand === 3) return "STRONG";
    if (madeHand >= 1) return "MARGINAL";
    if (drawStrength >= 2) return "DRAW_STRONG";
    if (drawStrength === 1) return "DRAW_WEAK";
    return "AIR";
}

function calculatePercentile(tier: string, heroStats?: RangeStats): string {
    if (!heroStats) return "Unknown";
    const dist = heroStats.distribution;
    const cumulative: Record<string, number> = {
        "MONSTER": dist.monster,
        "STRONG": dist.monster + dist.strong,
        "MARGINAL": dist.monster + dist.strong + dist.marginal,
        "DRAW_STRONG": dist.monster + dist.strong + dist.draw_strong,
        "DRAW_WEAK": dist.monster + dist.strong + dist.draw_strong + dist.draw_weak,
        "AIR": 100
    };
    const topPercent = cumulative[tier] || 50;
    return `Top ${topPercent.toFixed(0)}%`;
}

function generateInterpretation(bucket2D: string, tier: string, description: string): string {
    if (tier === "MONSTER") return "Premium hand - strong value betting spot";
    if (tier === "STRONG") return description.includes("draw") ? "Strong semi-bluff spot" : "Strong hand - value bet and protect";
    if (tier === "MARGINAL") return "Marginal hand - pot control, often check/call";
    if (tier === "DRAW_STRONG" || tier === "DRAW_WEAK") return "Drawing hand - consider semi-bluffing";
    return "Weak hand - bluff or give up";
}

function createHeroClassification(input: Agent1Input, ranges: RangeData, engineData: any): HeroClassification {
    const heroHand = input.positions.hero ?
        ((input.actions.find(a => a.player === 'hero' && (a as any).cards) as any)?.cards ||
            (input as any).heroHand ||
            (input as any).cards ||
            '') : '';

    const board = input.boardAnalysis.flop?.cards || '';

    // PREFLOP / NO BOARD LOGIC
    if (!board) {
        if (!heroHand || heroHand.length < 2) {
            return {
                bucket2D: "(0,0)",
                tier: "AIR",
                percentile: "Unknown",
                description: "Preflop - waiting for cards",
                interpretation: "Waiting for action"
            };
        }

        // Use Centralized Preflop Classifier
        return RangeEngine.categorizePreflopHand(heroHand);
    }

    const classification = classifyHand(heroHand, board);
    const tier = mapBucketToTier(classification.madeHand, classification.drawStrength);
    const heroStats = engineData?.flop?.heroStats || (typeof ranges.flop?.hero_range !== 'string' ? ranges.flop?.hero_range?.stats : undefined);
    const percentile = calculatePercentile(tier, heroStats);
    const interpretation = generateInterpretation(classification.bucket2D, tier, classification.description);

    return {
        bucket2D: classification.bucket2D,
        tier,
        percentile,
        description: classification.description,
        interpretation
    };
}


export { formatActionsForPrompt, RANGE_BUILDER_SYSTEM_PROMPT };
