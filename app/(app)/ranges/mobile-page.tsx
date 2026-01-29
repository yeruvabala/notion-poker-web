'use client';

import { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
    RFI_RANGES,
    THREE_BET_RANGES,
    VS_THREE_BET_RANGES,
    VS_FOUR_BET_RANGES,
    VS_FIVE_BET_RANGES
} from '@/app/api/coach/utils/gtoRangesV2';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE RANGES PAGE - Full GTO Range Support (RFI → 5-Bet)
// ═══════════════════════════════════════════════════════════════════════════════

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// All positions for 6-max
const ALL_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Scenario definitions with available positions
type Scenario = 'rfi' | '3bet' | 'vs3bet' | 'vs4bet' | 'vs5bet';

const SCENARIOS: { id: Scenario; label: string; description: string }[] = [
    { id: 'rfi', label: 'RFI', description: 'Raise First In' },
    { id: '3bet', label: '3-Bet', description: '3-Betting vs Open' },
    { id: 'vs3bet', label: 'vs 3-Bet', description: 'Facing 3-Bet' },
    { id: 'vs4bet', label: 'vs 4-Bet', description: 'Facing 4-Bet' },
    { id: 'vs5bet', label: 'vs 5-Bet', description: 'Facing 5-Bet' },
];

// Position colors
const POSITION_COLORS: Record<string, string> = {
    UTG: '#ef4444',
    HJ: '#f97316',
    CO: '#eab308',
    BTN: '#22c55e',
    SB: '#3b82f6',
    BB: '#8b5cf6',
};

// Available hero positions per scenario
const HERO_POSITIONS: Record<Scenario, string[]> = {
    rfi: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
    '3bet': ['HJ', 'CO', 'BTN', 'SB', 'BB'],
    vs3bet: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
    vs4bet: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
    vs5bet: ['UTG', 'HJ', 'CO', 'BTN'],
};

// Get valid opponent positions given hero position and scenario
function getOpponentPositions(scenario: Scenario, heroPos: string): string[] {
    const heroIdx = ALL_POSITIONS.indexOf(heroPos);

    if (scenario === '3bet') {
        // 3-betting: opponent opened before us (earlier positions)
        return ALL_POSITIONS.filter((_, idx) => idx < heroIdx);
    }
    if (scenario === 'vs3bet') {
        // Facing 3-bet: opponent is behind us (later positions)
        return ALL_POSITIONS.filter((_, idx) => idx > heroIdx);
    }
    if (scenario === 'vs4bet') {
        // Facing 4-bet after we 3-bet: original opener
        return ALL_POSITIONS.filter((_, idx) => idx < heroIdx);
    }
    if (scenario === 'vs5bet') {
        // Facing 5-bet after we 4-bet: the 3-bettor
        return ALL_POSITIONS.filter((_, idx) => idx > heroIdx);
    }
    return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getHandNotation(row: number, col: number): string {
    const r1 = RANKS[row];
    const r2 = RANKS[col];
    if (row === col) return `${r1}${r2}`;
    if (row < col) return `${r1}${r2}s`;
    return `${r2}${r1}o`;
}

function getDisplayNotation(row: number, col: number): string {
    const r1 = RANKS[row];
    const r2 = RANKS[col];
    if (row === col) return `${r1}${r2}`;
    if (row < col) return `${r1}${r2}`;
    return `${r2}${r1}`;
}

function getFrequency(hand: string, range: Record<string, number>): number {
    return range[hand] || 0;
}

function frequencyToClass(freq: number): string {
    if (freq >= 0.8) return 'freq-always';
    if (freq >= 0.5) return 'freq-often';
    if (freq >= 0.2) return 'freq-mixed';
    if (freq > 0) return 'freq-rare';
    return 'freq-fold';
}

function calculateRangeStats(range: Record<string, number>) {
    let weightedCombos = 0;
    for (let row = 0; row < 13; row++) {
        for (let col = 0; col < 13; col++) {
            const hand = getHandNotation(row, col);
            const freq = getFrequency(hand, range);
            const combos = row === col ? 6 : row < col ? 4 : 12;
            weightedCombos += combos * freq;
        }
    }
    return {
        percentage: ((weightedCombos / 1326) * 100).toFixed(1),
        combos: Math.round(weightedCombos),
    };
}

// Merge action frequencies into single range view
function mergeRangeActions(rangeData: Record<string, Record<string, number>> | undefined): Record<string, number> {
    if (!rangeData) return {};

    const merged: Record<string, number> = {};

    // Priority: 5bet/4bet > call > fold (show highest action)
    const actionPriority = ['5bet', '4bet', 'call'];

    for (const action of actionPriority) {
        if (rangeData[action]) {
            Object.entries(rangeData[action]).forEach(([hand, freq]) => {
                if (!merged[hand]) {
                    merged[hand] = freq as number;
                }
            });
        }
    }

    return merged;
}

// Get action breakdown for a specific hand
interface ActionBreakdown {
    raise: number;  // 3bet, 4bet or 5bet
    call: number;
    fold: number;
    raiseLabel: string;  // "3-Bet", "4-Bet" or "5-Bet"
}

function getActionBreakdown(
    scenario: Scenario,
    position: string,
    opponent: string,
    hand: string
): ActionBreakdown | null {
    // RFI has no action split (just raise frequency)
    if (scenario === 'rfi') {
        return null;
    }

    let rangeData: Record<string, Record<string, number>> | undefined;
    let raiseLabel = '4-Bet';
    let raiseKey = '4bet';

    if (scenario === '3bet') {
        // Making a 3-bet vs opener
        const key = `${position}_vs_${opponent}`;
        rangeData = THREE_BET_RANGES[key];
        raiseLabel = '3-Bet';
        raiseKey = '3bet';
    } else if (scenario === 'vs3bet') {
        // Facing 3-bet after opening
        const key = `${position}_vs_${opponent}_3bet`;
        rangeData = VS_THREE_BET_RANGES[key];
        raiseLabel = '4-Bet';
        raiseKey = '4bet';
    } else if (scenario === 'vs4bet') {
        // Facing 4-bet after 3-betting
        const key = `${position}_vs_${opponent}_4bet`;
        rangeData = VS_FOUR_BET_RANGES[key];
        raiseLabel = '5-Bet';
        raiseKey = '5bet';
    } else if (scenario === 'vs5bet') {
        // Facing 5-bet after 4-betting
        const key = `${position}_vs_${opponent}_5bet`;
        rangeData = VS_FIVE_BET_RANGES[key];
        raiseLabel = 'All-In';
        raiseKey = 'allin';
    }

    if (!rangeData) return null;

    const raiseFreq = rangeData[raiseKey]?.[hand] || 0;
    const callFreq = rangeData['call']?.[hand] || 0;

    // Calculate fold as remaining (1 - raise - call), but max at 1
    const total = raiseFreq + callFreq;
    const foldFreq = total > 0 ? Math.max(0, Math.min(1, 1 - total)) : 0;

    // Only return breakdown if hand is in range at all
    if (total === 0) return null;

    return {
        raise: raiseFreq,
        call: callFreq,
        fold: foldFreq,
        raiseLabel
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE RANGES PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MobileRangesPage() {
    const [selectedScenario, setSelectedScenario] = useState<Scenario>('rfi');
    const [selectedPosition, setSelectedPosition] = useState('BTN');
    const [selectedOpponent, setSelectedOpponent] = useState('');
    const [selectedHand, setSelectedHand] = useState<{ row: number; col: number } | null>(null);

    // Haptic feedback helper
    const haptic = (style: ImpactStyle = ImpactStyle.Light) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style }).catch(() => { });
        }
    };

    // Get available positions for current scenario
    const availablePositions = HERO_POSITIONS[selectedScenario];
    const opponentPositions = selectedScenario !== 'rfi'
        ? getOpponentPositions(selectedScenario, selectedPosition)
        : [];

    // Reset position if not available in new scenario
    useMemo(() => {
        if (!availablePositions.includes(selectedPosition)) {
            setSelectedPosition(availablePositions[0] || 'BTN');
        }
    }, [selectedScenario, availablePositions, selectedPosition]);

    // Set default opponent when switching scenarios
    useMemo(() => {
        if (opponentPositions.length > 0 && !opponentPositions.includes(selectedOpponent)) {
            setSelectedOpponent(opponentPositions[0]);
        }
    }, [opponentPositions, selectedOpponent]);

    // Get current range based on scenario
    const currentRange = useMemo(() => {
        if (selectedScenario === 'rfi') {
            return RFI_RANGES[selectedPosition] || {};
        }

        if (selectedScenario === '3bet') {
            // Making a 3-bet vs opener
            const key = `${selectedPosition}_vs_${selectedOpponent}`;
            const rangeData = THREE_BET_RANGES[key];
            if (rangeData) {
                // Merge 3bet action frequencies
                const merged: Record<string, number> = {};
                if (rangeData['3bet']) {
                    Object.entries(rangeData['3bet']).forEach(([hand, freq]) => {
                        merged[hand] = freq as number;
                    });
                }
                return merged;
            }
            return {};
        }

        if (selectedScenario === 'vs3bet') {
            // Facing 3-bet after opening
            const key = `${selectedPosition}_vs_${selectedOpponent}_3bet`;
            const rangeData = VS_THREE_BET_RANGES[key];
            return mergeRangeActions(rangeData);
        }

        if (selectedScenario === 'vs4bet') {
            // Facing 4-bet after 3-betting
            const key = `${selectedPosition}_vs_${selectedOpponent}_4bet`;
            const rangeData = VS_FOUR_BET_RANGES[key];
            return mergeRangeActions(rangeData);
        }

        if (selectedScenario === 'vs5bet') {
            // Facing 5-bet after 4-betting
            const key = `${selectedPosition}_vs_${selectedOpponent}_5bet`;
            const rangeData = VS_FIVE_BET_RANGES[key];
            return mergeRangeActions(rangeData);
        }

        return {};
    }, [selectedScenario, selectedPosition, selectedOpponent]);

    const stats = useMemo(() => calculateRangeStats(currentRange), [currentRange]);

    // Get selected hand data + action breakdown
    const selectedHandData = selectedHand ? (() => {
        const notation = getHandNotation(selectedHand.row, selectedHand.col);
        const frequency = getFrequency(notation, currentRange);
        const type = selectedHand.row === selectedHand.col ? 'Pocket Pair' :
            selectedHand.row < selectedHand.col ? 'Suited' : 'Offsuit';
        const combos = selectedHand.row === selectedHand.col ? 6 :
            selectedHand.row < selectedHand.col ? 4 : 12;
        const actionBreakdown = getActionBreakdown(selectedScenario, selectedPosition, selectedOpponent, notation);

        return { notation, frequency, type, combos, actionBreakdown };
    })() : null;

    const handleCellTap = (row: number, col: number) => {
        haptic(ImpactStyle.Light);
        if (selectedHand?.row === row && selectedHand?.col === col) {
            setSelectedHand(null);
        } else {
            setSelectedHand({ row, col });
        }
    };

    const handlePositionChange = (posId: string) => {
        haptic(ImpactStyle.Medium);
        setSelectedPosition(posId);
        setSelectedHand(null);
    };

    const handleScenarioChange = (scenario: Scenario) => {
        haptic(ImpactStyle.Medium);
        setSelectedScenario(scenario);
        setSelectedHand(null);
    };

    // Get scenario description for header
    const getScenarioDescription = () => {
        if (selectedScenario === 'rfi') {
            return `${selectedPosition} opens`;
        }
        if (selectedScenario === '3bet') {
            return `${selectedPosition} 3-bets vs ${selectedOpponent}`;
        }
        if (selectedScenario === 'vs3bet') {
            return `${selectedPosition} vs ${selectedOpponent} 3-bet`;
        }
        if (selectedScenario === 'vs4bet') {
            return `${selectedPosition} vs ${selectedOpponent} 4-bet`;
        }
        if (selectedScenario === 'vs5bet') {
            return `${selectedPosition} vs ${selectedOpponent} 5-bet`;
        }
        return '';
    };

    return (
        <div className="mobile-ranges-page">
            {/* Premium Page Header */}
            <MobilePageHeader title="RANGES" />

            {/* Stats Bar - 3 Column Layout */}
            <div className="mobile-ranges-stats">
                <div className="range-stat-main">
                    <span className="range-stat-value">{stats.percentage}%</span>
                    <span className="range-stat-label">of hands</span>
                </div>
                <div className="range-stat-divider" />
                <div className="range-stat-secondary">
                    <span className="range-stat-value">{stats.combos}</span>
                    <span className="range-stat-label">combos</span>
                </div>
                <div className="range-stat-divider" />
                <div className="range-stat-format">
                    <span className="format-bb">100 BB</span>
                    <span className="format-type">6-max</span>
                </div>
            </div>

            {/* Scenario Selector - Scrollable Pills */}
            <div className="mobile-ranges-scenarios-scroll">
                {SCENARIOS.map((scenario) => (
                    <button
                        key={scenario.id}
                        className={`scenario-btn ${selectedScenario === scenario.id ? 'active' : ''}`}
                        onClick={() => handleScenarioChange(scenario.id)}
                    >
                        {scenario.label}
                    </button>
                ))}
            </div>

            {/* Position Selector */}
            <div className="mobile-ranges-positions">
                {availablePositions.map((pos) => (
                    <button
                        key={pos}
                        className={`position-pill ${selectedPosition === pos ? 'active' : ''}`}
                        onClick={() => handlePositionChange(pos)}
                        style={{ '--pos-color': POSITION_COLORS[pos] } as React.CSSProperties}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            {/* Opponent Selector (for 3bet+ scenarios) */}
            {opponentPositions.length > 0 && (
                <div className="mobile-ranges-opponent">
                    <span className="opponent-label">vs:</span>
                    {opponentPositions.map((pos) => (
                        <button
                            key={pos}
                            className={`opponent-pill ${selectedOpponent === pos ? 'active' : ''}`}
                            onClick={() => { haptic(); setSelectedOpponent(pos); }}
                            style={{ '--pos-color': POSITION_COLORS[pos] } as React.CSSProperties}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            )}

            {/* Scenario Description */}
            <div className="mobile-ranges-scenario-desc">
                {getScenarioDescription()}
            </div>

            {/* Range Matrix */}
            <div className="mobile-ranges-matrix-container">
                <div className="mobile-ranges-matrix">
                    {RANKS.map((rowRank, rowIdx) => (
                        <div key={rowRank} className="matrix-row">
                            {RANKS.map((colRank, colIdx) => {
                                const hand = getHandNotation(rowIdx, colIdx);
                                const displayHand = getDisplayNotation(rowIdx, colIdx);
                                const freq = getFrequency(hand, currentRange);
                                const isSelected = selectedHand?.row === rowIdx && selectedHand?.col === colIdx;
                                const isPair = rowIdx === colIdx;
                                const isSuited = rowIdx < colIdx;

                                return (
                                    <button
                                        key={`${rowIdx}-${colIdx}`}
                                        className={`matrix-cell ${frequencyToClass(freq)} ${isSelected ? 'selected' : ''} ${isPair ? 'pair' : ''} ${isSuited ? 'suited' : 'offsuit'}`}
                                        onClick={() => handleCellTap(rowIdx, colIdx)}
                                    >
                                        <span className="cell-text">{displayHand}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected Hand Card */}
            {selectedHandData && (
                <div className="mobile-ranges-selected-card">
                    <div className="selected-hand-main">
                        <span className="selected-hand-notation">{selectedHandData.notation}</span>
                        <span className={`selected-hand-type ${selectedHandData.type.toLowerCase().replace(' ', '-')}`}>
                            {selectedHandData.type}
                        </span>
                    </div>

                    {/* Action Breakdown for 3bet+ scenarios */}
                    {selectedHandData.actionBreakdown ? (
                        <div className="action-breakdown">
                            <div className="action-row">
                                <span className="action-label raise">{selectedHandData.actionBreakdown.raiseLabel}</span>
                                <div className="action-bar-container">
                                    <div
                                        className="action-bar raise"
                                        style={{ width: `${selectedHandData.actionBreakdown.raise * 100}%` }}
                                    />
                                </div>
                                <span className="action-pct">{Math.round(selectedHandData.actionBreakdown.raise * 100)}%</span>
                            </div>
                            <div className="action-row">
                                <span className="action-label call">Call</span>
                                <div className="action-bar-container">
                                    <div
                                        className="action-bar call"
                                        style={{ width: `${selectedHandData.actionBreakdown.call * 100}%` }}
                                    />
                                </div>
                                <span className="action-pct">{Math.round(selectedHandData.actionBreakdown.call * 100)}%</span>
                            </div>
                            <div className="action-row">
                                <span className="action-label fold">Fold</span>
                                <div className="action-bar-container">
                                    <div
                                        className="action-bar fold"
                                        style={{ width: `${selectedHandData.actionBreakdown.fold * 100}%` }}
                                    />
                                </div>
                                <span className="action-pct">{Math.round(selectedHandData.actionBreakdown.fold * 100)}%</span>
                            </div>
                        </div>
                    ) : (
                        /* Original stats for RFI/3bet scenarios */
                        <div className="selected-hand-stats">
                            <div className="stat-item">
                                <span className="stat-value">
                                    {selectedHandData.frequency > 0
                                        ? `${Math.round(selectedHandData.frequency * 100)}%`
                                        : 'Fold'}
                                </span>
                                <span className="stat-label">Frequency</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{selectedHandData.combos}</span>
                                <span className="stat-label">Combos</span>
                            </div>
                            <div className="stat-item">
                                <span className={`action-badge ${selectedHandData.frequency >= 0.5 ? 'raise' : selectedHandData.frequency > 0 ? 'mixed' : 'fold'}`}>
                                    {selectedHandData.frequency >= 0.8 ? '🚀 Always' :
                                        selectedHandData.frequency >= 0.5 ? '✓ Often' :
                                            selectedHandData.frequency > 0 ? '⚖️ Mixed' : '✗ Fold'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="mobile-ranges-legend">
                <div className="legend-item"><div className="legend-dot freq-always" /><span>80-100%</span></div>
                <div className="legend-item"><div className="legend-dot freq-often" /><span>50-79%</span></div>
                <div className="legend-item"><div className="legend-dot freq-mixed" /><span>20-49%</span></div>
                <div className="legend-item"><div className="legend-dot freq-rare" /><span>1-19%</span></div>
                <div className="legend-item"><div className="legend-dot freq-fold" /><span>Fold</span></div>
            </div>

            {/* Bottom Navigation */}
            <MobileBottomNav />
        </div>
    );
}
