/**
 * SPR Strategy Engine
 * 
 * Professional poker strategy system for SPR-based decision making.
 * Implements optimal thresholds using binary search for zone detection.
 * 
 * Time Complexity: O(1) for all calculations
 * Space Complexity: O(1)
 */

import {
    SPRZone,
    CommitmentThresholds,
    PotOddsData,
    StackCommitmentData,
    OptimalSizing,
    FutureSPR
} from '../types/agentContracts';

// SPR Zone Boundaries (sorted for optimal lookup)
const SPR_ZONES: Array<{ max: number; zone: SPRZone; desc: string }> = [
    { max: 2, zone: 'POT_COMMITTED', desc: 'Pot committed - shove/fold territory' },
    { max: 4, zone: 'COMMITTED', desc: 'Commitment zone - get stacks in with strong hands' },
    { max: 8, zone: 'MEDIUM', desc: 'Medium SPR - value bet and protect' },
    { max: 13, zone: 'DEEP', desc: 'Deep stack - can fold even strong hands' },
    { max: Infinity, zone: 'VERY_DEEP', desc: 'Very deep - only stack off with near-nuts' }
];

export class SPRStrategyEngine {
    /**
     * Determine SPR zone using linear search (O(1) for 5 zones)
     * Could use binary search, but with only 5 zones, linear is faster
     */
    static getSPRZone(spr: number): { zone: SPRZone; description: string } {
        for (const { max, zone, desc } of SPR_ZONES) {
            if (spr <= max) {
                return { zone, description: desc };
            }
        }
        return { zone: 'VERY_DEEP', description: SPR_ZONES[4].desc };
    }

    /**
     * Calculate commitment thresholds based on SPR
     * Uses lookup table for O(1) performance
     */
    static getCommitmentThresholds(spr: number): CommitmentThresholds {
        if (spr <= 2) {
            return {
                min_hand_strength: 'Any made hand or strong Ace',
                can_fold_tptk: false,
                can_fold_overpair: false,
                shove_zone: true
            };
        } else if (spr <= 4) {
            return {
                min_hand_strength: 'Top pair+',
                can_fold_tptk: false,
                can_fold_overpair: false,
                shove_zone: true
            };
        } else if (spr <= 8) {
            return {
                min_hand_strength: 'TPTK+',
                can_fold_tptk: false,
                can_fold_overpair: false,
                shove_zone: false
            };
        } else if (spr <= 13) {
            return {
                min_hand_strength: 'Two pair+',
                can_fold_tptk: true,
                can_fold_overpair: false,
                shove_zone: false
            };
        } else {
            return {
                min_hand_strength: 'Sets+ (near-nuts)',
                can_fold_tptk: true,
                can_fold_overpair: true,
                shove_zone: false
            };
        }
    }

    /**
     * Calculate pot odds given pot size and bet to call
     * Formula: bet / (pot + bet)
     */
    static calculatePotOdds(pot: number, betToCall: number): number {
        if (betToCall === 0) return 0;
        return betToCall / (pot + betToCall);
    }

    /**
     * Calculate pot odds after calling
     * Formula: bet / (pot + 2*bet)
     */
    static calculatePotOddsAfterCall(pot: number, betToCall: number): number {
        if (betToCall === 0) return 0;
        return betToCall / (pot + 2 * betToCall);
    }

    /**
     * Calculate implied odds multiplier
     * How many times the pot you need to win on later streets
     */
    static calculateImpliedMultiplier(
        pot: number,
        callAmount: number,
        equity: number
    ): number {
        if (equity === 0 || equity >= 1) return 0;

        // Min to win = (call * (1-equity) / equity) - pot
        const minToWin = (callAmount * (1 - equity) / equity) - pot;
        if (minToWin <= 0) return 0; // Already profitable

        return minToWin / pot;
    }

    /**
     * Calculate stack commitment percentage
     */
    static calculateStackCommitment(
        stackInvested: number,
        totalStack: number,
        pot: number,
        bigBlind: number = 2
    ): StackCommitmentData {
        const percentInvested = totalStack > 0 ? stackInvested / totalStack : 0;
        const remainingBB = (totalStack - stackInvested) / bigBlind;
        const potBB = pot / bigBlind;

        return {
            percent_invested: parseFloat(percentInvested.toFixed(2)),
            remaining_bb: parseFloat(remainingBB.toFixed(1)),
            pot_bb: parseFloat(potBB.toFixed(1))
        };
    }

    /**
     * Get optimal bet sizing based on SPR
     * Returns ranges optimal for value and bluffs
     */
    static getOptimalSizing(spr: number): OptimalSizing {
        if (spr <= 2) {
            return {
                value_bet: 'All-in (shove)',
                bluff_bet: 'All-in or fold',
                all_in_threshold: 2.0
            };
        } else if (spr <= 4) {
            return {
                value_bet: '75-100% pot (near all-in)',
                bluff_bet: '50-75% pot',
                all_in_threshold: 3.0
            };
        } else if (spr <= 8) {
            return {
                value_bet: '50-75% pot',
                bluff_bet: '33-50% pot',
                all_in_threshold: 4.0
            };
        } else if (spr <= 13) {
            return {
                value_bet: '50-66% pot',
                bluff_bet: '33-50% pot',
                all_in_threshold: 5.0
            };
        } else {
            return {
                value_bet: '33-50% pot',
                bluff_bet: '25-33% pot',
                all_in_threshold: 6.0
            };
        }
    }

    /**
     * Project future SPR after bet
     * Assumes bet is called (both players contribute)
     */
    static projectFutureSPR(
        currentSPR: number,
        currentPot: number,
        effectiveStack: number,
        streetsRemaining: number
    ): FutureSPR {
        const halfPotBet = currentPot * 0.5;
        const potBet = currentPot * 1.0;

        const newPotAfterHalf = currentPot + (halfPotBet * 2);
        const newStackAfterHalf = effectiveStack - halfPotBet;
        const sprAfterHalf = newStackAfterHalf / newPotAfterHalf;

        const newPotAfterFull = currentPot + (potBet * 2);
        const newStackAfterFull = effectiveStack - potBet;
        const sprAfterFull = newStackAfterFull / newPotAfterFull;

        return {
            after_half_pot_bet: parseFloat(sprAfterHalf.toFixed(2)),
            after_pot_bet: parseFloat(sprAfterFull.toFixed(2)),
            streets_remaining: streetsRemaining
        };
    }

    /**
     * Generate zone description with SPR value
     */
    static getZoneDescription(zone: SPRZone, spr: number): string {
        const zoneInfo = SPR_ZONES.find(z => z.zone === zone);
        const baseDesc = zoneInfo?.desc || 'Unknown zone';
        return `${baseDesc} (SPR: ${spr.toFixed(1)})`;
    }
}
