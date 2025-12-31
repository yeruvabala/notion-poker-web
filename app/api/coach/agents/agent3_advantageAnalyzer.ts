/**
 * Agent 3: Advantage Analyzer (DETERMINISTIC VERSION)
 * 
 * PURPOSE: Calculate range advantage, nut advantage, and blocker effects using pure math.
 * 
 * APPROACH: Code-First (No LLM)
 * - Range Advantage: Compare hero vs villain distribution percentages
 * - Nut Advantage: Compare monster percentages
 * - Blocker Effects: Detect flush/straight blockers deterministically
 * 
 * RUNS: Tier 3 (parallel with Agent 2)
 * MODEL: NONE (Deterministic)
 * TIME: ~5ms
 */

import { Agent3Input, AdvantageData, BlockerEffects, RangeInfo, StreetAdvantage, Leader } from '../types/agentContracts';

/**
 * Calculate Range Advantage (Who's range connects better with the board?)
 */
function calculateRangeAdvantage(
    heroRange: string | RangeInfo,
    villainRange: string | RangeInfo
): { leader: Leader; percentage: string; reason: string } {

    // Extract stats
    const heroStats = typeof heroRange === 'string' ? null : heroRange.stats;
    const villainStats = typeof villainRange === 'string' ? null : villainRange.stats;

    // Fallback if stats unavailable
    if (!heroStats || !villainStats) {
        return {
            leader: 'even',
            percentage: 'Even 50-50',
            reason: 'Range stats unavailable for comparison'
        };
    }

    // Calculate strength (Monster + Strong + Marginal)
    const heroStrength = heroStats.distribution.monster + heroStats.distribution.strong + heroStats.distribution.marginal;
    const villainStrength = villainStats.distribution.monster + villainStats.distribution.strong + villainStats.distribution.marginal;

    const diff = heroStrength - villainStrength;

    let leader: Leader;
    let percentage: string;
    let reason: string;

    if (Math.abs(diff) < 5) {
        leader = 'even';
        percentage = 'Even 50-50';
        reason = `Hero: ${heroStrength.toFixed(1)}%, Villain: ${villainStrength.toFixed(1)}% (balanced)`;
    } else if (diff > 0) {
        leader = 'hero';
        const ratio = Math.round((heroStrength / villainStrength) * 100);
        percentage = `Hero ${ratio}%`;
        reason = `Hero: ${heroStrength.toFixed(1)}% (M+S+Mar), Villain: ${villainStrength.toFixed(1)}%`;
    } else {
        leader = 'villain';
        const ratio = Math.round((villainStrength / heroStrength) * 100);
        percentage = `Villain ${ratio}%`;
        reason = `Villain: ${villainStrength.toFixed(1)}% (M+S+Mar), Hero: ${heroStrength.toFixed(1)}%`;
    }

    return { leader, percentage, reason };
}

/**
 * Calculate Nut Advantage (Who can have the strongest hands?)
 */
function calculateNutAdvantage(
    heroRange: string | RangeInfo,
    villainRange: string | RangeInfo
): { leader: Leader; hero_strongest: string; villain_strongest: string; reason: string } {

    // Extract stats
    const heroStats = typeof heroRange === 'string' ? null : heroRange.stats;
    const villainStats = typeof villainRange === 'string' ? null : villainRange.stats;

    // Fallback if stats unavailable
    if (!heroStats || !villainStats) {
        return {
            leader: 'even',
            hero_strongest: 'Unknown',
            villain_strongest: 'Unknown',
            reason: 'Range stats unavailable'
        };
    }

    const heroMonster = heroStats.distribution.monster;
    const villainMonster = villainStats.distribution.monster;
    const heroStrong = heroStats.distribution.strong;
    const villainStrong = villainStats.distribution.strong;

    // Determine strongest hands
    let heroStrongest = 'Unknown';
    let villainStrongest = 'Unknown';

    if (heroMonster > 0) heroStrongest = `Monsters (${heroMonster.toFixed(1)}%)`;
    else if (heroStrong > 0) heroStrongest = `Strong hands (${heroStrong.toFixed(1)}%)`;
    else heroStrongest = 'Capped (no monsters)';

    if (villainMonster > 0) villainStrongest = `Monsters (${villainMonster.toFixed(1)}%)`;
    else if (villainStrong > 0) villainStrongest = `Strong hands (${villainStrong.toFixed(1)}%)`;
    else villainStrongest = 'Capped (no monsters)';

    // Determine leader
    let leader: Leader;
    let reason: string;

    const diff = heroMonster - villainMonster;

    if (Math.abs(diff) < 2) {
        leader = 'even';
        reason = `Both have similar nut frequency: Hero ${heroMonster.toFixed(1)}%, Villain ${villainMonster.toFixed(1)}%`;
    } else if (diff > 0) {
        leader = 'hero';
        reason = `Hero has more nuts: ${heroMonster.toFixed(1)}% vs Villain ${villainMonster.toFixed(1)}%`;
    } else {
        leader = 'villain';
        reason = `Villain has more nuts: ${villainMonster.toFixed(1)}% vs Hero ${heroMonster.toFixed(1)}%`;
    }

    return {
        leader,
        hero_strongest: heroStrongest,
        villain_strongest: villainStrongest,
        reason
    };
}

/**
 * Detect Blocker Effects (Does hero block key hands?)
 */
function detectBlockers(heroHand: string, board: string): BlockerEffects {
    const blockers: string[] = [];

    // Normalize hero hand
    const normalized = heroHand.replace(/\s/g, '');

    if (normalized.length < 4) {
        return { hero_blocks: [], strategic_impact: 'No significant blockers detected' };
    }

    const rank1 = normalized[0];
    const suit1 = normalized[1].toLowerCase();
    const rank2 = normalized[2];
    const suit2 = normalized[3].toLowerCase();

    // Parse board
    const boardCards = board.split(/\s+/).filter(c => c.length > 0);
    const boardSuits = boardCards.map(c => c.length >= 2 ? c[1].toLowerCase() : '');
    const boardRanks = boardCards.map(c => c[0]);

    // Check for flush blockers
    const suitCounts: Record<string, number> = {};
    for (const suit of boardSuits) {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    }

    for (const suit of [suit1, suit2]) {
        if (suitCounts[suit] >= 2) {
            // Hero blocks flush draw
            const suitName = { s: '♠', h: '♥', d: '♦', c: '♣' }[suit] || suit;
            blockers.push(`${suit === suit1 ? rank1 : rank2}${suitName} blocks flush combinations`);
        }
    }

    // Check for Ace blocker (blocks top pairs, nut flush)
    if (rank1 === 'A' || rank2 === 'A') {
        blockers.push('Ace blocks villain Ax combos (top pair, nut flush draw)');
    }

    // Check for King blocker
    if (rank1 === 'K' || rank2 === 'K') {
        if (boardRanks.includes('K')) {
            blockers.push('King blocks KK, AK combos (reduces sets/two pair)');
        }
    }

    // Strategic impact
    let impact = '';
    if (blockers.length === 0) {
        impact = 'No significant blockers detected';
    } else if (blockers.length === 1) {
        impact = 'Moderate blocker effect - slightly reduces villain strong hands';
    } else {
        impact = 'Strong blocker effect - significantly impacts villain range composition';
    }

    return { hero_blocks: blockers, strategic_impact: impact };
}

/**
 * Detect if advantages shifted between streets
 */
function detectShift(
    prevAdvantage: StreetAdvantage,
    currAdvantage: StreetAdvantage
): string | undefined {

    if (!prevAdvantage || !currAdvantage) return undefined;

    const rangeShift = prevAdvantage.range_advantage.leader !== currAdvantage.range_advantage.leader;
    const nutShift = prevAdvantage.nut_advantage.leader !== currAdvantage.nut_advantage.leader;

    if (rangeShift && nutShift) {
        return `Both range and nut advantage shifted to ${currAdvantage.range_advantage.leader}`;
    } else if (rangeShift) {
        return `Range advantage shifted to ${currAdvantage.range_advantage.leader}`;
    } else if (nutShift) {
        return `Nut advantage shifted to ${currAdvantage.nut_advantage.leader}`;
    }

    return undefined;
}

/**
 * Agent 3: Calculate Advantages (Deterministic)
 */
export async function agent3_advantageAnalyzer(input: Agent3Input): Promise<AdvantageData> {
    const startTime = Date.now();

    try {
        const result: AdvantageData = {
            flop: {
                range_advantage: { leader: 'even', percentage: '', reason: '' },
                nut_advantage: { leader: 'even', hero_strongest: '', villain_strongest: '', reason: '' }
            }
        };

        // Flop Analysis
        if (input.ranges.flop) {
            result.flop = {
                range_advantage: calculateRangeAdvantage(input.ranges.flop.hero_range, input.ranges.flop.villain_range),
                nut_advantage: calculateNutAdvantage(input.ranges.flop.hero_range, input.ranges.flop.villain_range)
            };
        } else {
            // Use preflop if flop not available
            result.flop = {
                range_advantage: calculateRangeAdvantage(input.ranges.preflop.hero_range, input.ranges.preflop.villain_range),
                nut_advantage: calculateNutAdvantage(input.ranges.preflop.hero_range, input.ranges.preflop.villain_range)
            };
        }

        // Turn Analysis
        if (input.ranges.turn) {
            const turnAdvantage = {
                range_advantage: calculateRangeAdvantage(input.ranges.turn.hero_range, input.ranges.turn.villain_range),
                nut_advantage: calculateNutAdvantage(input.ranges.turn.hero_range, input.ranges.turn.villain_range)
            };
            const shift = detectShift(result.flop, turnAdvantage);
            result.turn = { ...turnAdvantage, shift };
        }

        // River Analysis
        if (input.ranges.river) {
            const riverAdvantage = {
                range_advantage: calculateRangeAdvantage(input.ranges.river.hero_range, input.ranges.river.villain_range),
                nut_advantage: calculateNutAdvantage(input.ranges.river.hero_range, input.ranges.river.villain_range)
            };
            const shift = detectShift(result.turn || result.flop, riverAdvantage);
            result.river = { ...riverAdvantage, shift };
        }

        // Blocker Effects
        if (input.heroHand && input.boardAnalysis.flop?.cards) {
            result.blocker_effects = detectBlockers(input.heroHand, input.boardAnalysis.flop.cards);
        }

        const duration = Date.now() - startTime;
        console.log(`[Agent 3] Deterministic advantage calculation complete in ${duration}ms`);

        return result;

    } catch (error) {
        console.error('[Agent 3] Error:', error);

        // Fallback
        return {
            flop: {
                range_advantage: { leader: 'even', percentage: 'Even 50-50', reason: 'Error in calculation' },
                nut_advantage: { leader: 'even', hero_strongest: 'Unknown', villain_strongest: 'Unknown', reason: 'Error in calculation' }
            }
        };
    }
}
