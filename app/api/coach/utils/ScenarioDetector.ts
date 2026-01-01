/**
 * Phase 16: Scenario Detector
 * 
 * Analyzes hand scenarios to determine if equity calculation is needed.
 * Only calculates equity for critical commitment decisions:
 * - All-in scenarios (any street)
 * - Large call decisions (bet >= 50% pot on flop/turn/river)
 * 
 * Skips equity for routine spots:
 * - Preflop RFI (range-based decision)
 * - Calling preflop RFI (playability/implied odds)
 * - Small postflop bets (pot control)
 */

import type { Action, HeroActions, Position } from '../types/agentContracts';

export interface HandScenario {
    street: 'preflop' | 'flop' | 'turn' | 'river';

    // All-in detection
    hasAllIn: boolean;

    // Bet sizing
    facingBet: boolean;
    betAmount?: number;
    potSize: number;
    betToPotRatio?: number;

    // Preflop specific
    isRFI: boolean;              // Hero raises first in
    isCallingRFI: boolean;        // Hero calls someone's RFI
    facing3BetOr4Bet: boolean;    // Hero faces 3-bet or 4-bet

    // Decision type
    decisionType: 'open' | 'call' | 'raise' | 'all-in' | 'unknown';
}

export class ScenarioDetector {
    /**
     * Analyze hand scenario to determine context
     */
    static analyzeScenario(input: {
        heroActions: HeroActions;
        actions: Action[];
        potSizes?: any;
        positions?: { hero: string; villain?: string };
    }): HandScenario {
        const currentStreet = this.getCurrentStreet(input.heroActions);
        const potSize = this.getPotSize(input.potSizes, currentStreet);

        const scenario: HandScenario = {
            street: currentStreet,
            hasAllIn: this.detectAllIn(input.actions),
            facingBet: this.isFacingBet(input.heroActions, currentStreet),
            potSize,
            isRFI: this.isRFI(input.actions, input.positions),
            isCallingRFI: this.isCallingRFI(input.actions, input.positions),
            facing3BetOr4Bet: this.isFacing3BetOr4Bet(input.actions),
            decisionType: this.getDecisionType(input.heroActions, currentStreet)
        };

        // Calculate bet sizing if facing bet
        if (scenario.facingBet) {
            scenario.betAmount = this.getBetAmount(input.actions, currentStreet);
            if (scenario.betAmount && scenario.potSize > 0) {
                scenario.betToPotRatio = scenario.betAmount / scenario.potSize;
            }
        }

        return scenario;
    }

    /**
     * Decision tree: Should we calculate equity?
     */
    static shouldCalculateEquity(scenario: HandScenario): boolean {
        // DEBUG: Log what we're seeing
        console.error('[ScenarioDetector] DEBUG - Scenario:', {
            street: scenario.street,
            hasAllIn: scenario.hasAllIn,
            facingBet: scenario.facingBet,
            betToPotRatio: scenario.betToPotRatio,
            isRFI: scenario.isRFI,
            isCallingRFI: scenario.isCallingRFI,
            facing3BetOr4Bet: scenario.facing3BetOr4Bet
        });

        // Rule 1: Always calculate if there's an all-in
        if (scenario.hasAllIn) {
            console.log('[ScenarioDetector] Equity needed: All-in scenario');
            return true;
        }

        // Rule 2: Calculate for large call decisions postflop
        if (scenario.street !== 'preflop' && scenario.facingBet && scenario.betToPotRatio !== undefined) {
            if (scenario.betToPotRatio >= 0.50) {
                console.log(`[ScenarioDetector] Equity needed: Large bet (${(scenario.betToPotRatio * 100).toFixed(0)}% pot)`);
                return true;
            }
        }


        // Rule 3: 3-bet/4-bet - use range + SPR strategy (SKIP equity!)
        if (scenario.facing3BetOr4Bet) {
            console.log('[ScenarioDetector] ✗ Equity skipped: 3-bet/4-bet (range + SPR strategy)');
            return false;
        }

        // Rule 4: Skip for RFI (range-based decision)
        if (scenario.isRFI) {
            console.log('[ScenarioDetector] Equity skipped: RFI (range decision)');
            return false;
        }

        // Rule 5: Skip for calling RFI (playability/implied odds)
        if (scenario.isCallingRFI) {
            console.log('[ScenarioDetector] Equity skipped: Calling RFI (playability)');
            return false;
        }

        // Rule 6: Skip for small postflop bets
        if (scenario.facingBet && scenario.betToPotRatio !== undefined && scenario.betToPotRatio < 0.50) {
            console.log(`[ScenarioDetector] Equity skipped: Small bet (${(scenario.betToPotRatio * 100).toFixed(0)}% pot)`);
            return false;
        }

        // Default: Skip (err on conservative side)
        console.log('[ScenarioDetector] Equity skipped: Routine spot');
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // Helper Methods
    // ═══════════════════════════════════════════════════════════

    private static getCurrentStreet(heroActions: HeroActions): 'preflop' | 'flop' | 'turn' | 'river' {
        if (heroActions.river && (heroActions.river.first || heroActions.river.second)) return 'river';
        if (heroActions.turn && (heroActions.turn.first || heroActions.turn.second)) return 'turn';
        if (heroActions.flop && (heroActions.flop.first || heroActions.flop.second)) return 'flop';
        return 'preflop';
    }

    private static detectAllIn(actions: Action[]): boolean {
        return actions.some(a => {
            const action = (a.action || '').toLowerCase();
            return action === 'all-in' ||
                action === 'allin' ||
                action === 'jam' ||
                action === 'shove';
        });
    }

    private static isFacingBet(heroActions: HeroActions, street: string): boolean {
        const streetActions = (heroActions as any)[street];
        if (!streetActions) return false;

        // Check if hero called or raised (implies facing a bet)
        const firstAction = streetActions.first?.action;
        const secondAction = streetActions.second?.action;

        return (
            firstAction === 'call' ||
            firstAction === 'raise' ||
            secondAction === 'call' ||
            secondAction === 'raise'
        );
    }

    private static getBetAmount(actions: Action[], street: string): number | undefined {
        // Find the last bet/raise on this street before hero's action
        const streetActions = actions.filter(a => a.street === street);

        for (let i = streetActions.length - 1; i >= 0; i--) {
            const action = streetActions[i];
            if ((action.action === 'bet' || action.action === 'raise') && action.player !== 'hero') {
                return action.amount || 0;
            }
        }

        return undefined;
    }

    private static getPotSize(potSizes: any, street: string): number {
        if (!potSizes) return 100; // Default fallback

        const streetPot = (potSizes as any)[street];
        return typeof streetPot === 'number' ? streetPot : 100;
    }

    private static isRFI(actions: Action[], positions?: { hero: string; villain?: string }): boolean {
        if (!positions) return false;

        const preflopActions = actions.filter(a => a.street === 'preflop');

        // Find hero's first action
        const heroFirstAction = preflopActions.find(a => a.player === 'hero' || a.player === positions.hero);

        if (!heroFirstAction || heroFirstAction.action !== 'raise') {
            return false;
        }

        // Check if any raises before hero (indicates not RFI)
        const actionsBeforeHero = preflopActions.slice(0, preflopActions.indexOf(heroFirstAction));
        const raisesBeforeHero = actionsBeforeHero.filter(a => a.action === 'raise' || a.action === 'bet');

        return raisesBeforeHero.length === 0;
    }

    private static isCallingRFI(actions: Action[], positions?: { hero: string; villain?: string }): boolean {
        if (!positions) return false;

        const preflopActions = actions.filter(a => a.street === 'preflop');

        // Find hero's first action
        const heroFirstAction = preflopActions.find(a => a.player === 'hero' || a.player === positions.hero);

        if (!heroFirstAction || heroFirstAction.action !== 'call') {
            return false;
        }

        // Check if there was a raise before hero (indicates calling RFI)
        const actionsBeforeHero = preflopActions.slice(0, preflopActions.indexOf(heroFirstAction));
        const raisesBeforeHero = actionsBeforeHero.filter(a => a.action === 'raise');

        // If exactly 1 raise before hero, and hero calls, it's calling RFI
        return raisesBeforeHero.length === 1;
    }

    private static isFacing3BetOr4Bet(actions: Action[]): boolean {
        const preflopRaises = actions.filter(a =>
            a.street === 'preflop' && (a.action === 'raise' || a.action === 'bet')
        );

        // DEBUG: Log what we're seeing
        console.error('[ScenarioDetector] isFacing3BetOr4Bet DEBUG:');
        console.error('  Total actions:', actions.length);
        console.error('  Preflop raises:', preflopRaises.length);
        console.error('  Actions:', JSON.stringify(actions.map((a: any) => ({ street: a.street, player: a.player, action: a.action }))));

        // 2+ raises = 3-bet scenario, 3+ raises = 4-bet scenario
        const result = preflopRaises.length >= 2;
        console.error('  Result:', result);
        return result;
    }

    private static getDecisionType(heroActions: HeroActions, street: string): HandScenario['decisionType'] {
        const streetActions = (heroActions as any)[street];
        if (!streetActions) return 'unknown';

        const firstAction = streetActions.first?.action;
        const secondAction = streetActions.second?.action;

        if (firstAction === 'raise' || secondAction === 'raise') return 'raise';
        if (firstAction === 'call' || secondAction === 'call') return 'call';
        if (firstAction === 'all-in' || secondAction === 'all-in') return 'all-in';
        if (firstAction === 'bet' || secondAction === 'bet') return 'raise';

        return 'unknown';
    }
}
