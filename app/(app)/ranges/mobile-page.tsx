'use client';

import { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { RFI_RANGES, VS_THREE_BET_RANGES } from '@/app/api/coach/utils/gtoRanges';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE RANGES PAGE - Premium Touch-Friendly GTO Range Matrix
// ═══════════════════════════════════════════════════════════════════════════════

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const POSITIONS = [
    { id: 'UTG', label: 'UTG', color: '#ef4444' },
    { id: 'HJ', label: 'HJ', color: '#f97316' },
    { id: 'CO', label: 'CO', color: '#eab308' },
    { id: 'BTN', label: 'BTN', color: '#22c55e' },
    { id: 'SB', label: 'SB', color: '#3b82f6' },
];

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

// Display notation without s/o suffix (visual styling indicates suited/offsuit)
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

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE RANGES PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MobileRangesPage() {
    const [selectedPosition, setSelectedPosition] = useState('BTN');
    const [selectedScenario, setSelectedScenario] = useState<'rfi' | 'vs3bet'>('rfi');
    const [selectedHand, setSelectedHand] = useState<{ row: number; col: number } | null>(null);
    const [vs3betOpener, setVs3betOpener] = useState('BB');

    // Haptic feedback helper
    const haptic = (style: ImpactStyle = ImpactStyle.Light) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style }).catch(() => { });
        }
    };

    // Get current range
    const currentRange = useMemo(() => {
        if (selectedScenario === 'rfi') {
            return RFI_RANGES[selectedPosition] || {};
        }
        const key = `${selectedPosition}_vs_${vs3betOpener}_3bet`;
        const rangeData = VS_THREE_BET_RANGES[key];
        if (rangeData) {
            const merged: Record<string, number> = {};
            if (rangeData['4bet']) {
                Object.entries(rangeData['4bet']).forEach(([hand, freq]) => {
                    merged[hand] = (merged[hand] || 0) + (freq as number);
                });
            }
            if (rangeData['call']) {
                Object.entries(rangeData['call']).forEach(([hand, freq]) => {
                    merged[hand] = Math.max(merged[hand] || 0, freq as number);
                });
            }
            return merged;
        }
        return {};
    }, [selectedPosition, selectedScenario, vs3betOpener]);

    const stats = useMemo(() => calculateRangeStats(currentRange), [currentRange]);

    const selectedHandData = selectedHand ? {
        notation: getHandNotation(selectedHand.row, selectedHand.col),
        frequency: getFrequency(getHandNotation(selectedHand.row, selectedHand.col), currentRange),
        type: selectedHand.row === selectedHand.col ? 'Pocket Pair' :
            selectedHand.row < selectedHand.col ? 'Suited' : 'Offsuit',
        combos: selectedHand.row === selectedHand.col ? 6 :
            selectedHand.row < selectedHand.col ? 4 : 12,
    } : null;

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
    };

    return (
        <div className="mobile-ranges-page">
            {/* Premium Page Header */}
            <MobilePageHeader title="RANGES" />

            {/* Stats Bar - Shows range percentage */}
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
            </div>

            {/* Position Selector - Pill buttons */}
            <div className="mobile-ranges-positions">
                {POSITIONS.map((pos) => (
                    <button
                        key={pos.id}
                        className={`position-pill ${selectedPosition === pos.id ? 'active' : ''}`}
                        onClick={() => handlePositionChange(pos.id)}
                        style={{ '--pos-color': pos.color } as React.CSSProperties}
                    >
                        {pos.label}
                    </button>
                ))}
            </div>

            {/* Scenario Toggle */}
            <div className="mobile-ranges-scenarios">
                <button
                    className={`scenario-btn ${selectedScenario === 'rfi' ? 'active' : ''}`}
                    onClick={() => { haptic(); setSelectedScenario('rfi'); }}
                >
                    RFI
                </button>
                <button
                    className={`scenario-btn ${selectedScenario === 'vs3bet' ? 'active' : ''}`}
                    onClick={() => { haptic(); setSelectedScenario('vs3bet'); }}
                >
                    vs 3-Bet
                </button>
            </div>

            {/* vs 3-Bet Opener Selector */}
            {selectedScenario === 'vs3bet' && (
                <div className="mobile-ranges-3bet-opener">
                    <span className="opener-label">3-bettor:</span>
                    {['CO', 'BTN', 'SB', 'BB'].map((pos) => (
                        <button
                            key={pos}
                            className={`opener-pill ${vs3betOpener === pos ? 'active' : ''}`}
                            onClick={() => { haptic(); setVs3betOpener(pos); }}
                        >
                            {pos}
                        </button>
                    ))}
                </div>
            )}

            {/* Range Matrix - Compact 13x13 Grid */}
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
                                        {/* Four suit corners for suited hands */}
                                        {isSuited && !isPair && (
                                            <>
                                                <span className="suit-corner top-left">♠</span>
                                                <span className="suit-corner top-right">♥</span>
                                                <span className="suit-corner bottom-left">♦</span>
                                                <span className="suit-corner bottom-right">♣</span>
                                            </>
                                        )}
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
