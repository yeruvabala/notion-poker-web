'use client';

import { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  RFI_RANGES,
  THREE_BET_RANGES,
  VS_THREE_BET_RANGES,
  VS_FOUR_BET_RANGES,
  VS_FIVE_BET_RANGES
} from '@/app/api/coach/utils/gtoRangesV2';
import MobileRangesPage from './mobile-page';

// =============================================================================
// CONSTANTS
// =============================================================================

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// All positions for 6-max
const ALL_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const POSITIONS = [
  { id: 'UTG', label: 'UTG', tooltip: 'Under The Gun' },
  { id: 'HJ', label: 'HJ', tooltip: 'Hijack' },
  { id: 'CO', label: 'CO', tooltip: 'Cutoff' },
  { id: 'BTN', label: 'BTN', tooltip: 'Button' },
  { id: 'SB', label: 'SB', tooltip: 'Small Blind' },
  { id: 'BB', label: 'BB', tooltip: 'Big Blind' },
];

type Scenario = 'rfi' | '3bet' | 'vs3bet' | 'vs4bet' | 'vs5bet';

const SCENARIOS: { id: Scenario; label: string; tooltip: string }[] = [
  { id: 'rfi', label: 'RFI', tooltip: 'Raise First In - Opening ranges' },
  { id: '3bet', label: '3-Bet', tooltip: 'Making a 3-bet vs opener' },
  { id: 'vs3bet', label: 'vs 3-Bet', tooltip: 'When you open and face a 3-bet' },
  { id: 'vs4bet', label: 'vs 4-Bet', tooltip: 'When you 3-bet and face a 4-bet' },
  { id: 'vs5bet', label: 'vs 5-Bet', tooltip: 'When you 4-bet and face a 5-bet' },
];

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

// Merge action frequencies into single range view
function mergeRangeActions(rangeData: Record<string, Record<string, number>> | undefined): Record<string, number> {
  if (!rangeData) return {};

  const merged: Record<string, number> = {};
  const actionPriority = ['5bet', '4bet', '3bet', 'call'];

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
  raiseLabel: string;  // "Raise", "3-Bet", "4-Bet" or "5-Bet"
}

function getActionBreakdown(
  scenario: Scenario,
  position: string,
  opponent: string,
  hand: string
): ActionBreakdown | null {
  // RFI: raise vs fold (no calling option)
  if (scenario === 'rfi') {
    const rfiRange = RFI_RANGES[position];
    if (!rfiRange) return null;

    const raiseFreq = rfiRange[hand] || 0;
    // If hand not in range at all, return null
    if (raiseFreq === 0) return null;

    const foldFreq = 1 - raiseFreq;

    return {
      raise: raiseFreq,
      call: 0,  // No calling in RFI
      fold: foldFreq,
      raiseLabel: 'Raise'
    };
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getHandNotation(row: number, col: number): string {
  const r1 = RANKS[row];
  const r2 = RANKS[col];

  if (row === col) {
    return `${r1}${r2}`; // Pocket pair
  } else if (row < col) {
    return `${r1}${r2}s`; // Suited (above diagonal)
  } else {
    return `${r2}${r1}o`; // Offsuit (below diagonal)
  }
}

function getFrequency(hand: string, range: Record<string, number>): number {
  return range[hand] || 0;
}

function frequencyToColor(freq: number): string {
  if (freq >= 0.8) return 'var(--range-always)';
  if (freq >= 0.5) return 'var(--range-often)';
  if (freq >= 0.2) return 'var(--range-mixed)';
  if (freq > 0) return 'var(--range-rare)';
  return 'var(--range-fold)';
}

function frequencyToGlow(freq: number): string {
  if (freq >= 0.8) return '0 0 12px rgba(34, 197, 94, 0.5)';
  if (freq >= 0.5) return '0 0 8px rgba(234, 179, 8, 0.4)';
  if (freq >= 0.2) return '0 0 6px rgba(249, 115, 22, 0.3)';
  return 'none';
}

// Text color: dark on bright backgrounds, light on dark
function frequencyToTextColor(freq: number): string {
  if (freq >= 0.5) return '#1a1a1a'; // Dark text for green/yellow
  if (freq >= 0.2) return '#1a1a1a'; // Dark text for orange
  return '#e2e8f0'; // Light text for dark backgrounds (purple/fold)
}

function calculateRangeStats(range: Record<string, number>) {
  let totalCombos = 0;
  let weightedCombos = 0;

  // Calculate weighted combos for all 169 unique hands
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = getHandNotation(row, col);
      const freq = getFrequency(hand, range);

      let combos: number;
      if (row === col) {
        combos = 6; // Pocket pairs: 6 combos
      } else if (row < col) {
        combos = 4; // Suited: 4 combos
      } else {
        combos = 12; // Offsuit: 12 combos
      }

      totalCombos += combos;
      weightedCombos += combos * freq;
    }
  }

  return {
    percentage: ((weightedCombos / 1326) * 100).toFixed(1),
    combos: Math.round(weightedCombos),
    handsInRange: Object.keys(range).filter(h => range[h] > 0).length,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function RangesPage() {
  const [isNative, setIsNative] = useState<boolean | null>(null); // null = not checked yet
  const [selectedPosition, setSelectedPosition] = useState('BTN');
  const [selectedScenario, setSelectedScenario] = useState<Scenario>('rfi');
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState(''); // For multi-scenario opponent

  // Check for native platform on client-side only (after mount)
  useMemo(() => {
    if (typeof window !== 'undefined' && isNative === null) {
      try {
        setIsNative(Capacitor.isNativePlatform());
      } catch {
        setIsNative(false);
      }
    }
  }, [isNative]);

  // Mobile detection - render mobile page on native platforms
  if (isNative === true) {
    return <MobileRangesPage />;
  }

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

  // Get the current range based on selection
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
  }, [selectedPosition, selectedScenario, selectedOpponent]);

  const stats = useMemo(() => calculateRangeStats(currentRange), [currentRange]);

  const hoveredHand = hoveredCell
    ? getHandNotation(hoveredCell.row, hoveredCell.col)
    : null;
  const hoveredFreq = hoveredHand ? getFrequency(hoveredHand, currentRange) : 0;

  // Get selected hand data + action breakdown
  const selectedHandData = selectedCell ? (() => {
    const notation = getHandNotation(selectedCell.row, selectedCell.col);
    const frequency = getFrequency(notation, currentRange);
    const type = selectedCell.row === selectedCell.col ? 'Pocket Pair' :
      selectedCell.row < selectedCell.col ? 'Suited' : 'Offsuit';
    const combos = selectedCell.row === selectedCell.col ? 6 :
      selectedCell.row < selectedCell.col ? 4 : 12;
    const actionBreakdown = getActionBreakdown(selectedScenario, selectedPosition, selectedOpponent, notation);

    return { notation, frequency, type, combos, actionBreakdown };
  })() : null;

  // Cell click handler
  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ row, col });
    }
  };

  return (
    <div className="op-surface ranges-page">
      <div className="dashboard-bg-pattern" />

      <main className="ranges-main">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, marginTop: 0 }}>
          <h1 className="homepage-title">Ranges</h1>
          {/* Card Suit Decorations with Shimmer */}
          <div className="suit-decoration">
            <span>♠</span>
            <span>♥</span>
            <span>♦</span>
            <span>♣</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="ranges-controls platinum-inner-border">
          {/* Position Selector */}
          <div className="control-group">
            <span className="control-label">Position</span>
            <div className="position-selector">
              {availablePositions.map((posId) => {
                const pos = POSITIONS.find(p => p.id === posId) || { id: posId, label: posId, tooltip: posId };
                return (
                  <button
                    key={posId}
                    className={`position-btn ${selectedPosition === posId ? 'active' : ''}`}
                    onClick={() => setSelectedPosition(posId)}
                    title={pos.tooltip}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scenario Selector */}
          <div className="control-group">
            <span className="control-label">Scenario</span>
            <div className="scenario-selector">
              {SCENARIOS.map((scen) => (
                <button
                  key={scen.id}
                  className={`scenario-btn ${selectedScenario === scen.id ? 'active' : ''}`}
                  onClick={() => setSelectedScenario(scen.id)}
                  title={scen.tooltip}
                >
                  {scen.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opponent Selector (shown for all non-RFI scenarios) */}
          {selectedScenario !== 'rfi' && opponentPositions.length > 0 && (
            <div className="control-group">
              <span className="control-label">vs</span>
              <div className="position-selector">
                {opponentPositions.map((pos) => (
                  <button
                    key={pos}
                    className={`position-btn small ${selectedOpponent === pos ? 'active' : ''}`}
                    onClick={() => setSelectedOpponent(pos)}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Grid Area */}
        <div className="ranges-content">
          {/* Hand Matrix Grid */}
          <div className="matrix-container platinum-inner-border">
            <div className="matrix-grid">
              {/* Column Headers */}
              <div className="matrix-row header-row">
                <div className="matrix-cell corner-cell"></div>
                {RANKS.map((rank) => (
                  <div key={rank} className="matrix-cell header-cell">{rank}</div>
                ))}
              </div>

              {/* Grid Rows */}
              {RANKS.map((rowRank, rowIdx) => (
                <div key={rowRank} className="matrix-row">
                  {/* Row Header */}
                  <div className="matrix-cell header-cell">{rowRank}</div>

                  {/* Grid Cells */}
                  {RANKS.map((colRank, colIdx) => {
                    const hand = getHandNotation(rowIdx, colIdx);
                    const freq = getFrequency(hand, currentRange);
                    const isPair = rowIdx === colIdx;
                    const isSuited = rowIdx < colIdx;
                    const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                    const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;

                    // Get action breakdown for coloring
                    const breakdown = getActionBreakdown(selectedScenario, selectedPosition, selectedOpponent, hand);

                    // Use action-based coloring for hands in range
                    if (breakdown) {
                      // Determine color class based on action frequencies
                      let actionClass = 'action-fold-dom'; // default

                      const { raise, call, fold } = breakdown;
                      const tolerance = 0.15; // for detecting "mix of all 3"

                      // Check for 100% actions first
                      if (raise >= 0.95) {
                        actionClass = 'action-raise-full';
                      } else if (call >= 0.95) {
                        actionClass = 'action-call-full';
                      }
                      // Check for mix of all 3 (all within tolerance of each other)
                      else if (Math.abs(raise - call) < tolerance &&
                        Math.abs(call - fold) < tolerance &&
                        Math.abs(raise - fold) < tolerance &&
                        raise > 0.2 && call > 0.2 && fold > 0.2) {
                        actionClass = 'action-mixed';
                      }
                      // Dominant action
                      else if (raise >= call && raise >= fold) {
                        actionClass = 'action-raise-dom';
                      } else if (call > raise && call >= fold) {
                        actionClass = 'action-call-dom';
                      } else if (fold > raise && fold > call) {
                        actionClass = 'action-fold-dom';
                      }

                      return (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className={`matrix-cell hand-cell ${actionClass} ${isPair ? 'pair' : ''} ${isSuited ? 'suited' : 'offsuit'} ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                          onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                        >
                          <span className="hand-text">{hand}</span>
                        </div>
                      );
                    }

                    // Fold/not in range - gray background
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`matrix-cell hand-cell ${isPair ? 'pair' : ''} ${isSuited ? 'suited' : 'offsuit'} ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                        onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                      >
                        <span className="hand-text">{hand}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Stats & Legend Panel */}
          <div className="stats-panel">
            {/* Current Selection Info */}
            <div className="stat-card platinum-inner-border">
              <div className="stat-card-header">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 16l4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="stat-title">Range Stats</span>
              </div>
              <div className="stat-content">
                <div className="stat-row">
                  <span className="stat-label">Opening</span>
                  <span className="stat-value highlight">{stats.percentage}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Combos</span>
                  <span className="stat-value">{stats.combos}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Unique Hands</span>
                  <span className="stat-value">{stats.handsInRange}</span>
                </div>
              </div>
            </div>

            {/* Selected Hand - Action Breakdown */}
            <div className="stat-card platinum-inner-border hover-card">
              <div className="stat-card-header">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                <span className="stat-title">Hand Details</span>
              </div>
              <div className="stat-content">
                {selectedHandData ? (
                  <>
                    <div className="selected-hand-main">
                      <span className="hover-hand">{selectedHandData.notation}</span>
                      <span className="hand-type-badge">{selectedHandData.type}</span>
                    </div>

                    {/* Action Breakdown with bars */}
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
                      <div className="fold-label">Not in range</div>
                    )}

                    <div className="hover-type">{selectedHandData.combos} combos</div>
                  </>
                ) : hoveredHand ? (
                  <>
                    <div className="hover-hand">{hoveredHand}</div>
                    <div className="hover-freq">
                      {hoveredFreq > 0 ? (
                        <>
                          <span className="freq-label">Frequency:</span>
                          <span className="freq-value">{Math.round(hoveredFreq * 100)}%</span>
                        </>
                      ) : (
                        <span className="fold-label">Fold</span>
                      )}
                    </div>
                    <div className="hover-type">
                      {hoveredCell?.row === hoveredCell?.col ? 'Pocket Pair' :
                        (hoveredCell?.row || 0) < (hoveredCell?.col || 0) ? 'Suited' : 'Offsuit'}
                    </div>
                  </>
                ) : (
                  <div className="hover-placeholder">
                    Click a cell to see action breakdown
                  </div>
                )}
              </div>
            </div>

            {/* Action Legend */}
            <div className="stat-card platinum-inner-border">
              <div className="stat-card-header">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <span className="stat-title">Legend</span>
              </div>
              <div className="stat-content legend-content">
                <div className="legend-item">
                  <div className="legend-color action-raise"></div>
                  <span>Raise / 3-Bet+</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color action-call"></div>
                  <span>Call</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color action-fold"></div>
                  <span>Fold</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color action-mixed-legend"></div>
                  <span>Mixed (All 3)</span>
                </div>
              </div>
            </div>

            {/* Position Info */}
            <div className="stat-card platinum-inner-border">
              <div className="stat-card-header">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                </svg>
                <span className="stat-title">Current View</span>
              </div>
              <div className="stat-content">
                <div className="current-view">
                  <span className="view-position">{selectedPosition}</span>
                  <span className="view-scenario">
                    {selectedScenario === 'rfi' ? 'RFI Range' :
                      selectedScenario === '3bet' ? `3-Bet vs ${selectedOpponent}` :
                        selectedScenario === 'vs3bet' ? `vs ${selectedOpponent} 3-Bet` :
                          selectedScenario === 'vs4bet' ? `vs ${selectedOpponent} 4-Bet` :
                            `vs ${selectedOpponent} 5-Bet`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Styles */}
      <style jsx>{`
        /* CSS Variables for Range Colors */
        :global(:root) {
          --range-always: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          --range-often: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
          --range-mixed: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          --range-rare: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          --range-fold: #1a1a1a;
        }

        .ranges-page {
          min-height: 100vh;
          padding: 24px 32px;
          position: relative;
        }

        .ranges-main {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header */
        .ranges-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .ranges-title {
          font-size: 42px;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #a3a3a3 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
          letter-spacing: -1px;
        }

        /* Use global suit-decoration styles for shimmer effect */

        /* Controls Bar */
        .ranges-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          padding: 16px 24px;
          margin-bottom: 24px;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .control-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9ca3af;
        }

        .position-selector, .scenario-selector {
          display: flex;
          gap: 4px;
        }

        .position-btn, .scenario-btn {
          padding: 8px 16px;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #1f1f1f;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .position-btn.small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .position-btn:hover, .scenario-btn:hover {
          background: #2a2a2a;
          border-color: #505050;
          color: #e2e8f0;
        }

        .position-btn.active, .scenario-btn.active {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-color: #3b82f6;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        /* Main Content Grid */
        .ranges-content {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
        }

        /* Matrix Container */
        .matrix-container {
          padding: 20px;
          background: linear-gradient(145deg, #1e1e1e, #141414);
          overflow-x: auto;
        }

        .matrix-grid {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 600px;
        }

        .matrix-row {
          display: flex;
          gap: 2px;
        }

        .header-row {
          margin-bottom: 4px;
        }

        .matrix-cell {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          position: relative;
          transition: all 0.15s ease;
        }

        .corner-cell {
          background: transparent;
        }

        .header-cell {
          background: #252525;
          color: #9ca3af;
          font-size: 13px;
        }

        .hand-cell {
          background: #1a1a1a;
          color: #e2e8f0;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.15s ease, border 0.15s ease, box-shadow 0.15s ease;
        }

        /* Action-based colors */
        .hand-cell.action-raise-full {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%);
          border: 1px solid rgba(239, 68, 68, 0.5);
          box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.25);
        }

        .hand-cell.action-raise-dom {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.7) 0%, rgba(220, 38, 38, 0.6) 40%, rgba(185, 28, 28, 0.5) 100%);
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        .hand-cell.action-call-full {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 40%, #15803d 100%);
          border: 1px solid rgba(34, 197, 94, 0.5);
          box-shadow: inset 0 0 10px rgba(34, 197, 94, 0.25);
        }

        .hand-cell.action-call-dom {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.7) 0%, rgba(22, 163, 74, 0.6) 40%, rgba(21, 128, 61, 0.5) 100%);
          border: 1px solid rgba(34, 197, 94, 0.35);
        }

        .hand-cell.action-fold-dom {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.5) 0%, rgba(37, 99, 235, 0.4) 40%, rgba(29, 78, 216, 0.35) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .hand-cell.action-mixed {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.65) 0%, rgba(139, 92, 246, 0.55) 40%, rgba(124, 58, 237, 0.5) 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
        }

        .hand-cell.pair {
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .hand-cell.suited {
          opacity: 1;
        }

        .hand-cell.offsuit {
          opacity: 0.9;
        }

        .hand-cell.hovered {
          transform: scale(1.12);
          z-index: 10;
          border: 2px solid #ffffff !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.3) !important;
        }

        .hand-cell.selected {
          transform: scale(1.1);
          z-index: 9;
          border: 2px solid #fbbf24 !important;
          box-shadow: 0 0 15px rgba(251, 191, 36, 0.5) !important;
        }

        .hand-text {
          font-weight: 700;
        }

        /* Dark text for action-colored cells */
        .hand-cell.action-raise-full .hand-text,
        .hand-cell.action-raise-dom .hand-text,
        .hand-cell.action-call-full .hand-text,
        .hand-cell.action-call-dom .hand-text,
        .hand-cell.action-fold-dom .hand-text,
        .hand-cell.action-mixed .hand-text {
          color: #1a1a1a;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .freq-indicator {
          position: absolute;
          bottom: 2px;
          right: 3px;
          font-size: 8px;
          font-weight: 500;
          opacity: 0.7;
        }

        /* Stats Panel */
        .stats-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .stat-card {
          padding: 20px;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
        }

        .stat-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-icon-svg {
          width: 18px;
          height: 18px;
          color: #9ca3af;
          flex-shrink: 0;
        }

        .stat-title {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-label {
          font-size: 14px;
          color: #9ca3af;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .stat-value.highlight {
          font-size: 28px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Hover Card */
        .hover-card .stat-content {
          align-items: center;
          text-align: center;
        }

        .hover-hand {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .hover-freq {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .freq-label {
          font-size: 12px;
          color: #9ca3af;
        }

        .freq-value {
          font-size: 18px;
          font-weight: 700;
          color: #22c55e;
        }

        .fold-label {
          font-size: 14px;
          color: #6b7280;
        }

        .hover-type {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .hover-placeholder {
          font-size: 12px;
          color: #6b7280;
          text-align: center;
          padding: 12px;
        }

        /* Legend */
        .legend-content {
          gap: 6px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #9ca3af;
        }

        .legend-color {
          width: 18px;
          height: 18px;
          border-radius: 4px;
        }

        .legend-color.action-raise {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
        }

        .legend-color.action-call {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
        }

        .legend-color.action-fold {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
        }

        .legend-color.action-mixed-legend {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
          box-shadow: 0 0 6px rgba(168, 85, 247, 0.4);
        }

        /* Action Breakdown Panel */
        .selected-hand-main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .hand-type-badge {
          background: rgba(255, 255, 255, 0.1);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 12px 0;
        }

        .action-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-label {
          width: 50px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .action-label.raise {
          color: #ef4444;
        }

        .action-label.call {
          color: #22c55e;
        }

        .action-label.fold {
          color: #3b82f6;
        }

        .action-bar-container {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .action-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .action-bar.raise {
          background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
        }

        .action-bar.call {
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        }

        .action-bar.fold {
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
        }

        .action-pct {
          width: 40px;
          font-size: 12px;
          font-weight: 700;
          color: #e5e7eb;
          text-align: right;
        }

        /* Current View */
        .current-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .view-position {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .view-scenario {
          font-size: 12px;
          color: #6b7280;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .ranges-content {
            grid-template-columns: 1fr;
          }

          .stats-panel {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .ranges-page {
            padding: 16px;
          }

          .ranges-controls {
            flex-direction: column;
            gap: 16px;
          }

          .matrix-cell {
            width: 36px;
            height: 36px;
            font-size: 9px;
          }

          .stats-panel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
