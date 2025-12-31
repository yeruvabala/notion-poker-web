/**
 * Mistake Classifier - Deterministic Classification Engine
 * 
 * PURPOSE: Deterministically classify hero's decisions vs GTO
 * 
 * Time Complexity: O(n) where n = number of decision points
 * Space Complexity: O(n) for storing results
 * 
 * Unlike LLM-based classification:
 * - 100% consistent (no variance)
 * - Instant (0ms, no API call)
 * - Free (no token cost)
 * - Testable (unit tests verify correctness)
 */

import {
    PlayQuality,
    ActionType,
    MixedActionRecommendation,
    SingleAction,
    HeroActions,
    GTOStrategy,
    Position,
    SPRData,
    HeroClassification,
    RangeData,
    EquityData,
    LeakCategory  // Import from contracts
} from '../types/agentContracts';

// Re-export for external use
export type { LeakCategory } from '../types/agentContracts';

export interface StrategicLeakCategory {
    category: LeakCategory;
    count: number;
    examples: string[];
}

export interface DecisionClassification {
    street: string;
    decision_point: string;
    hero_action: ActionType;
    gto_primary: SingleAction;
    gto_alternative?: SingleAction;
    play_quality: PlayQuality;
    leak_category?: LeakCategory;
}

export interface AnalysisContext {
    spr: SPRData;
    heroClassification?: HeroClassification;
    ranges: RangeData;
    equity: EquityData;
    potOddsNeeded: number;
}

export class MistakeClassifier {
    /**
     * Core classification logic - deterministic comparison
     * 
     * @returns 'optimal' | 'acceptable' | 'mistake'
     */
    static classifyDecision(
        heroAction: ActionType,
        gtoPrimary: SingleAction,
        gtoAlternative?: SingleAction
    ): PlayQuality {
        // Primary match = optimal
        if (heroAction === gtoPrimary.action) {
            return 'optimal';
        }

        // Alternative match = acceptable
        if (gtoAlternative && heroAction === gtoAlternative.action) {
            return 'acceptable';
        }

        // No match = mistake
        return 'mistake';
    }

    /**
     * Categorize a mistake by strategic type
     */
    static categorizeMistake(
        decision: DecisionClassification,
        context: AnalysisContext
    ): LeakCategory {
        const { street, hero_action, decision_point } = decision;
        const { spr, heroClassification, equity, potOddsNeeded } = context;

        // Priority 1: SPR awareness mistakes (most critical)
        if (spr.commitment_thresholds.shove_zone && hero_action === 'fold') {
            return 'spr_awareness'; // Folding in shove zone (SPR < 3)
        }

        // Priority 2: Equity miscalculation (folding with correct odds)
        if (equity.equity_vs_range > potOddsNeeded && hero_action === 'fold') {
            return 'equity_miscalculation';
        }

        // Priority 3: Range awareness (overfolding strong parts of range)
        const percentile = heroClassification?.percentile || '';
        if (percentile.includes('Top 10%') && hero_action === 'fold') {
            return 'range_awareness'; // Folding top of range
        }

        // Priority 4: Value betting mistakes (not betting with strong hands)
        const heroTier = heroClassification?.tier || 'UNKNOWN';
        if (['STRONG', 'MONSTER'].includes(heroTier) && hero_action === 'check' && decision_point.includes('initial')) {
            return 'postflop_value'; // Missed value bet
        }

        // Priority 5: Bluffing mistakes (betting with weak hands)
        if (['WEAK', 'AIR'].includes(heroTier) && hero_action === 'bet') {
            return 'postflop_bluff'; // Bad bluff
        }

        // Priority 6: Street-specific (more granular than generic postflop)
        // Phase 14.5: Use street-specific categories for better analytics
        if (street === 'preflop') {
            return 'preflop_mistake';
        }
        if (street === 'flop') {
            return 'flop_mistake';
        }
        if (street === 'turn') {
            return 'turn_mistake';
        }
        if (street === 'river') {
            return 'river_mistake';
        }

        // Default fallback
        return 'postflop_value';
    }

    /**
     * Analyze all decisions and classify them
     */
    static analyzeAllDecisions(
        heroActions: HeroActions,
        gtoStrategy: GTOStrategy,
        positions: Position,
        context: AnalysisContext
    ): DecisionClassification[] {
        const decisions: DecisionClassification[] = [];
        const isIP = !['SB', 'BB'].includes(positions.hero.toUpperCase());

        // Helper to add a decision
        const addDecision = (
            street: string,
            decisionPoint: string,
            heroAction: ActionType,
            gtoRec?: MixedActionRecommendation
        ) => {
            if (!gtoRec) return;

            const playQuality = this.classifyDecision(
                heroAction,
                gtoRec.primary,
                gtoRec.alternative
            );

            const classification: DecisionClassification = {
                street,
                decision_point: decisionPoint,
                hero_action: heroAction,
                gto_primary: gtoRec.primary,
                gto_alternative: gtoRec.alternative,
                play_quality: playQuality
            };

            // Add leak category if it's a mistake
            if (playQuality === 'mistake') {
                classification.leak_category = this.categorizeMistake(classification, context);
            }

            decisions.push(classification);
        };

        // Preflop
        if (heroActions.preflop?.first) {
            addDecision('preflop', 'initial_action', heroActions.preflop.first.action, gtoStrategy.preflop.initial_action);

            if (heroActions.preflop.second) {
                addDecision('preflop', 'response_to_3bet', heroActions.preflop.second.action, gtoStrategy.preflop.response_to_3bet);
            }
        }

        // Flop
        if (heroActions.flop?.first && gtoStrategy.flop) {
            const action = heroActions.flop.first.action;

            if (isIP) {
                const villainChecked = ['check', 'bet'].includes(action);
                const gtoRec = villainChecked
                    ? gtoStrategy.flop.if_villain_checks_to_hero
                    : gtoStrategy.flop.if_villain_bets_into_hero;
                addDecision('flop', villainChecked ? 'vs_check' : 'vs_bet', action, gtoRec);

                if (heroActions.flop.second) {
                    addDecision('flop', 'vs_raise', heroActions.flop.second.action, gtoStrategy.flop.if_bet_and_villain_raises);
                }
            } else {
                addDecision('flop', 'initial_action', action, gtoStrategy.flop.initial_action);

                if (heroActions.flop.second) {
                    const gtoRec = heroActions.flop.first.action === 'check'
                        ? gtoStrategy.flop.if_check_and_villain_bets
                        : gtoStrategy.flop.if_bet_and_villain_raises;
                    addDecision('flop', 'response', heroActions.flop.second.action, gtoRec);
                }
            }
        }

        // Turn (same pattern)
        if (heroActions.turn?.first && gtoStrategy.turn) {
            const action = heroActions.turn.first.action;

            if (isIP) {
                const villainChecked = ['check', 'bet'].includes(action);
                const gtoRec = villainChecked
                    ? gtoStrategy.turn.if_villain_checks_to_hero
                    : gtoStrategy.turn.if_villain_bets_into_hero;
                addDecision('turn', villainChecked ? 'vs_check' : 'vs_bet', action, gtoRec);

                if (heroActions.turn.second) {
                    addDecision('turn', 'vs_raise', heroActions.turn.second.action, gtoStrategy.turn.if_bet_and_villain_raises);
                }
            } else {
                addDecision('turn', 'initial_action', action, gtoStrategy.turn.initial_action);

                if (heroActions.turn.second) {
                    const gtoRec = heroActions.turn.first.action === 'check'
                        ? gtoStrategy.turn.if_check_and_villain_bets
                        : gtoStrategy.turn.if_bet_and_villain_raises;
                    addDecision('turn', 'response', heroActions.turn.second.action, gtoRec);
                }
            }
        }

        // River (same pattern)
        if (heroActions.river?.first && gtoStrategy.river) {
            const action = heroActions.river.first.action;

            if (isIP) {
                const villainChecked = ['check', 'bet'].includes(action);
                const gtoRec = villainChecked
                    ? gtoStrategy.river.if_villain_checks_to_hero
                    : gtoStrategy.river.if_villain_bets_into_hero;
                addDecision('river', villainChecked ? 'vs_check' : 'vs_bet', action, gtoRec);

                if (heroActions.river.second) {
                    addDecision('river', 'vs_raise', heroActions.river.second.action, gtoStrategy.river.if_bet_and_villain_raises);
                }
            } else {
                addDecision('river', 'initial_action', action, gtoStrategy.river.initial_action);

                if (heroActions.river.second) {
                    const gtoRec = heroActions.river.first.action === 'check'
                        ? gtoStrategy.river.if_check_and_villain_bets
                        : gtoStrategy.river.if_bet_and_villain_raises;
                    addDecision('river', 'response', heroActions.river.second.action, gtoRec);
                }
            }
        }

        return decisions;
    }

    /**
     * Group mistakes by category for leak detection
     */
    static categorizeLeaks(decisions: DecisionClassification[]): StrategicLeakCategory[] {
        const leakMap = new Map<LeakCategory, StrategicLeakCategory>();

        for (const decision of decisions) {
            if (decision.play_quality === 'mistake' && decision.leak_category) {
                const category = decision.leak_category;

                if (!leakMap.has(category)) {
                    leakMap.set(category, {
                        category,
                        count: 0,
                        examples: []
                    });
                }

                const leak = leakMap.get(category)!;
                leak.count++;
                leak.examples.push(`${decision.street}: ${decision.hero_action} (should be ${decision.gto_primary.action})`);
            }
        }

        return Array.from(leakMap.values()).sort((a, b) => b.count - a.count);
    }

    /**
     * Identify the worst leak (most frequent mistake category)
     */
    static identifyWorstLeak(leakCategories: StrategicLeakCategory[]): string | null {
        if (leakCategories.length === 0) return null;

        const worst = leakCategories[0];
        const categoryNames: Record<LeakCategory, string> = {
            'spr_awareness': 'SPR awareness',
            'equity_miscalculation': 'Pot odds calculations',
            'range_awareness': 'Range awareness',
            'postflop_value': 'Missing value bets',
            'postflop_bluff': 'Bluffing too much',
            'preflop_mistake': 'Preflop decision-making',
            'flop_mistake': 'Flop strategy',
            'turn_mistake': 'Turn strategy',
            'river_mistake': 'River strategy'
        };

        return `${categoryNames[worst.category]} (${worst.count} mistake${worst.count > 1 ? 's' : ''})`;
    }
}
