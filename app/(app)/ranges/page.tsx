'use client';

import { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { RFI_RANGES, VS_THREE_BET_RANGES } from '@/app/api/coach/utils/gtoRanges';
import MobileRangesPage from './mobile-page';

// =============================================================================
// CONSTANTS
// =============================================================================

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const POSITIONS = [
  { id: 'UTG', label: 'UTG', tooltip: 'Under The Gun' },
  { id: 'HJ', label: 'HJ', tooltip: 'Hijack' },
  { id: 'CO', label: 'CO', tooltip: 'Cutoff' },
  { id: 'BTN', label: 'BTN', tooltip: 'Button' },
  { id: 'SB', label: 'SB', tooltip: 'Small Blind' },
];

const SCENARIOS = [
  { id: 'rfi', label: 'RFI', tooltip: 'Raise First In - Opening ranges' },
  { id: 'vs3bet', label: 'vs 3-Bet', tooltip: 'When you open and face a 3-bet' },
];

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
  // Mobile detection - render mobile page on native platforms
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  if (isNative) {
    return <MobileRangesPage />;
  }

  const [selectedPosition, setSelectedPosition] = useState('BTN');
  const [selectedScenario, setSelectedScenario] = useState('rfi');
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [vs3betOpener, setVs3betOpener] = useState('BTN'); // For vs 3-bet scenario

  // Get the current range based on selection
  const currentRange = useMemo(() => {
    if (selectedScenario === 'rfi') {
      return RFI_RANGES[selectedPosition] || {};
    } else {
      // vs 3-bet scenario - get the appropriate range
      const key = `${selectedPosition}_vs_${vs3betOpener}_3bet`;
      const rangeData = VS_THREE_BET_RANGES[key];
      if (rangeData) {
        // Merge 4bet and call ranges, prioritizing 4bet
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
    }
  }, [selectedPosition, selectedScenario, vs3betOpener]);

  const stats = useMemo(() => calculateRangeStats(currentRange), [currentRange]);

  const hoveredHand = hoveredCell
    ? getHandNotation(hoveredCell.row, hoveredCell.col)
    : null;
  const hoveredFreq = hoveredHand ? getFrequency(hoveredHand, currentRange) : 0;

  return (
    <div className="op-surface ranges-page">
      <div className="dashboard-bg-pattern" />

      <main className="ranges-main">
        {/* Header */}
        <div className="ranges-header">
          <h1 className="ranges-title">Preflop Ranges</h1>
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
              {POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  className={`position-btn ${selectedPosition === pos.id ? 'active' : ''}`}
                  onClick={() => setSelectedPosition(pos.id)}
                  title={pos.tooltip}
                >
                  {pos.label}
                </button>
              ))}
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

          {/* vs 3-bet Opener Selector (only shown when vs3bet is selected) */}
          {selectedScenario === 'vs3bet' && (
            <div className="control-group">
              <span className="control-label">3-Bettor</span>
              <div className="position-selector">
                {['CO', 'BTN', 'SB', 'BB'].map((pos) => (
                  <button
                    key={pos}
                    className={`position-btn small ${vs3betOpener === pos ? 'active' : ''}`}
                    onClick={() => setVs3betOpener(pos)}
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

                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`matrix-cell hand-cell ${isPair ? 'pair' : ''} ${isSuited ? 'suited' : 'offsuit'} ${isHovered ? 'hovered' : ''} ${freq > 0 ? 'in-range' : ''}`}
                        style={{
                          '--cell-bg': frequencyToColor(freq),
                          '--cell-glow': frequencyToGlow(freq),
                          '--cell-opacity': Math.max(0.15, freq),
                          '--cell-text': frequencyToTextColor(freq),
                        } as React.CSSProperties}
                        onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span className="hand-text">{hand}</span>
                        {freq > 0 && freq < 1 && (
                          <span className="freq-indicator">{Math.round(freq * 100)}</span>
                        )}
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
                <span className="stat-icon">📊</span>
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

            {/* Hover Info */}
            <div className="stat-card platinum-inner-border hover-card">
              <div className="stat-card-header">
                <span className="stat-icon">🎯</span>
                <span className="stat-title">Selected Hand</span>
              </div>
              <div className="stat-content">
                {hoveredHand ? (
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
                    Hover over a cell to see details
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="stat-card platinum-inner-border">
              <div className="stat-card-header">
                <span className="stat-icon">🎨</span>
                <span className="stat-title">Legend</span>
              </div>
              <div className="stat-content legend-content">
                <div className="legend-item">
                  <div className="legend-color always"></div>
                  <span>80-100% (Always)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color often"></div>
                  <span>50-79% (Often)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color mixed"></div>
                  <span>20-49% (Mixed)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color rare"></div>
                  <span>1-19% (Rare)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color fold"></div>
                  <span>0% (Fold)</span>
                </div>
              </div>
            </div>

            {/* Position Info */}
            <div className="stat-card platinum-inner-border">
              <div className="stat-card-header">
                <span className="stat-icon">📍</span>
                <span className="stat-title">Current View</span>
              </div>
              <div className="stat-content">
                <div className="current-view">
                  <span className="view-position">{selectedPosition}</span>
                  <span className="view-scenario">
                    {selectedScenario === 'rfi' ? 'RFI Range' : `vs ${vs3betOpener} 3-Bet`}
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

        .suit-decoration {
          display: flex;
          justify-content: center;
          gap: 16px;
          font-size: 20px;
          opacity: 0.6;
        }

        .suit-decoration span:nth-child(2),
        .suit-decoration span:nth-child(3) {
          color: #ef4444;
        }

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
          grid-template-columns: 1fr 280px;
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
          background: var(--cell-bg, #1a1a1a);
          color: var(--cell-text, #e2e8f0);
          cursor: pointer;
          border: 1px solid transparent;
        }

        .hand-cell.in-range {
          box-shadow: var(--cell-glow, none);
        }

        .hand-cell.pair {
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .hand-cell.suited {
          opacity: 1;
        }

        .hand-cell.offsuit {
          opacity: 0.9;
        }

        .hand-cell.hovered {
          transform: scale(1.15);
          z-index: 10;
          border: 2px solid #ffffff !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.3) !important;
        }

        .hand-text {
          font-weight: 700;
        }

        /* Black gradient text for hands in range */
        .hand-cell.in-range .hand-text {
          background: linear-gradient(180deg, #2a2a2a 0%, #000000 50%, #1a1a1a 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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
          gap: 16px;
        }

        .stat-card {
          padding: 16px;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
        }

        .stat-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #3a3a3a;
        }

        .stat-icon {
          font-size: 16px;
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
          font-size: 13px;
          color: #9ca3af;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .stat-value.highlight {
          font-size: 24px;
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

        .legend-color.always {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .legend-color.often {
          background: linear-gradient(135deg, #eab308, #ca8a04);
        }

        .legend-color.mixed {
          background: linear-gradient(135deg, #f97316, #ea580c);
        }

        .legend-color.rare {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }

        .legend-color.fold {
          background: #1a1a1a;
          border: 1px solid #3a3a3a;
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
