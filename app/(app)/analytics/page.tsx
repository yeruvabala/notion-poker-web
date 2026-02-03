"use client";

import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";
import MobileAnalyticsPage from "./mobile-page";
import {
  ChipStacksIcon,
  PokerChipIcon,
  HoleCardsIcon,
} from "@/components/icons/PokerIcons";
import { Trophy, Target, Droplets, TrendingUp, BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Overview = {
  winrate_bb: number | null;
  total_hands: number | null;
  weakest_seat: string | null;
  weakest_bb: number | null;
  primary_leak: string | null;
  primary_leak_bb: number | null;
};

type SeatRow = { hero_position: string; bb: number; n: number };
type LeakRow = { learning_tag: string; bb: number; n: number };
type TrendRow = { hand_date: string; cum_avg_bb: number };

// Color palette
const colors = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  muted: "#6b7280",
};

function getWinrateColor(bb: number): string {
  if (bb >= 2) return colors.green;
  if (bb >= 0) return colors.yellow;
  return colors.red;
}

function getPositionColor(bb: number): string {
  if (bb >= 1) return colors.green;
  if (bb >= 0) return colors.yellow;
  return colors.red;
}

export default function AnalyticsPage() {
  // Mobile detection - render mobile page on native platforms
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  if (isNative) {
    return <MobileAnalyticsPage />;
  }

  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [stakes, setStakes] = useState<string>("10NL");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [leaks, setLeaks] = useState<LeakRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ month, stakes }).toString();
    fetch(`/api/analytics?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setOverview(json.overview);
        setSeats(json.seats);
        setLeaks(json.leaks);
        setTrend(json.trend);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month, stakes]);

  const seatDial = useMemo(() => {
    // Support both 6-max and 9-handed (full ring) positions
    const fullOrder = ["UTG", "UTG+1", "UTG+2", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
    const byPos: Record<string, SeatRow> = {};
    for (const r of seats) byPos[r.hero_position] = r;

    // Only include positions that have data
    return fullOrder
      .filter(k => byPos[k] !== undefined)
      .map((k) => ({
        pos: k,
        bb: byPos[k]?.bb ?? 0,
        n: byPos[k]?.n ?? 0,
      }));
  }, [seats]);

  // Find best and worst positions
  const bestPosition = useMemo(() => {
    if (!seatDial.length) return null;
    return seatDial.reduce((best, curr) => curr.bb > best.bb ? curr : best, seatDial[0]);
  }, [seatDial]);

  const worstPosition = useMemo(() => {
    if (!seatDial.length) return null;
    return seatDial.reduce((worst, curr) => curr.bb < worst.bb ? curr : worst, seatDial[0]);
  }, [seatDial]);

  return (
    <div className="analytics-premium op-surface">
      {/* Subtle Background Pattern */}
      <div className="premium-bg">
        <div className="bg-grid" />
      </div>

      {/* Header with title and filters - centered like other pages */}
      <header className="analytics-header" style={{ textAlign: 'center', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className="homepage-title">Analytics</h1>
        <div className="suit-decoration">
          <span>♠</span>
          <span>♥</span>
          <span>♦</span>
          <span>♣</span>
        </div>
        <div className="header-filters" style={{ marginTop: 16 }}>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="premium-select"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setUTCMonth(d.getUTCMonth() - i);
              const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
              const lbl = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
              return <option key={ym} value={ym}>{lbl}</option>;
            })}
          </select>
          <select
            value={stakes}
            onChange={(e) => setStakes(e.target.value)}
            className="premium-select"
          >
            {["2NL", "5NL", "10NL", "25NL", "50NL", "100NL", "200NL"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div className="premium-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* HERO WINRATE CARD - The Star of the Show */}
      <section className="hero-section">
        <div className="hero-card platinum-inner-border">
          <div className="hero-glow" style={{ '--glow-color': getWinrateColor(overview?.winrate_bb ?? 0) } as React.CSSProperties} />
          <div className="hero-border" />
          <div className="hero-content">
            <div className="hero-label">WIN RATE</div>
            <div className="hero-value" style={{ color: getWinrateColor(overview?.winrate_bb ?? 0) }}>
              {(overview?.winrate_bb ?? 0) >= 0 ? '+' : ''}{fmt(overview?.winrate_bb ?? 0)}
              <span className="hero-unit">bb/100</span>
            </div>
            <div className="hero-meta">
              <span className="hero-hands">{overview?.total_hands?.toLocaleString() ?? 0} hands analyzed</span>
              <span className="hero-divider">•</span>
              <span className="hero-positions">{seatDial.length} positions tracked</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats Row */}
      <section className="stats-grid">
        <div className="glass-card stat-item platinum-inner-border">
          <div className="stat-icon trophy"><Trophy size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Best Position</div>
            <div className="stat-value green">{bestPosition?.pos ?? "—"}</div>
            <div className="stat-detail">{bestPosition ? `+${fmt(bestPosition.bb)} bb/hand` : "No data yet"}</div>
          </div>
        </div>

        <div className="glass-card stat-item platinum-inner-border">
          <div className="stat-icon target"><Target size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Focus Area</div>
            <div className="stat-value orange">{overview?.weakest_seat ?? "—"}</div>
            <div className="stat-detail">{overview?.weakest_seat ? `${fmt(overview?.weakest_bb ?? 0)} bb/hand` : "No data yet"}</div>
          </div>
        </div>

        <div className="glass-card stat-item platinum-inner-border">
          <div className="stat-icon leak"><Droplets size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Primary Leak</div>
            <div className="stat-value yellow">{formatLeakName(overview?.primary_leak)}</div>
            <div className="stat-detail">{overview?.primary_leak ? `${fmt(overview?.primary_leak_bb ?? 0)} bb impact` : "No leaks detected"}</div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Position Performance - Left side */}
        <section className="glass-card section-card platinum-inner-border">
          <div className="section-header">
            <div className="section-title">
              <BarChart3 size={18} className="title-icon" />
              Position Performance
            </div>
          </div>
          <div className="positions-grid">
            {seatDial.length > 0 ? (
              seatDial.map((seat) => (
                <div
                  key={seat.pos}
                  className="position-chip"
                  style={{ '--chip-color': getPositionColor(seat.bb) } as React.CSSProperties}
                >
                  <div className="chip-glow" />
                  <div className="chip-name">{seat.pos}</div>
                  <div className="chip-bb">{seat.bb >= 0 ? '+' : ''}{fmt(seat.bb)}</div>
                  <div className="chip-hands">{seat.n} hands</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon">♠️</div>
                <div className="empty-text">Play some hands to see position stats</div>
              </div>
            )}
          </div>
          {worstPosition && worstPosition.bb < 0 && (
            <div className="insight-banner">
              <Target size={16} className="insight-bulb" />
              <span>Focus on <strong>{worstPosition.pos}</strong> — you're leaking {fmt(Math.abs(worstPosition.bb))} bb/hand there</span>
            </div>
          )}
        </section>

        {/* Top Leaks - Right side */}
        <section className="glass-card section-card platinum-inner-border">
          <div className="section-header">
            <div className="section-title">
              <Droplets size={18} className="title-icon" />
              Top Leaks to Fix
            </div>
            {leaks.length > 0 && <span className="section-badge">{leaks.length} found</span>}
          </div>
          <div className="leaks-list">
            {leaks.slice(0, 5).map((leak, idx) => (
              <LeakRow key={leak.learning_tag} leak={leak} rank={idx + 1} />
            ))}
            {!leaks.length && (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <div className="empty-text">No significant leaks detected</div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Performance Trend Chart */}
      <section className="glass-card chart-section platinum-inner-border">
        <div className="section-header">
          <div className="section-title">
            <TrendingUp size={18} className="title-icon" />
            Performance Trend
          </div>
          <span className="section-badge">Last 200 hands</span>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="premiumGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis
                dataKey="hand_date"
                stroke="#4a4a4a"
                tickFormatter={(v) => v.slice(5)}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#4a4a4a"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
              />
              <ReferenceLine y={0} stroke="#404040" strokeDasharray="5 5" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(20, 20, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  backdropFilter: 'blur(10px)'
                }}
                labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                formatter={(v: any) => [`${fmt(Number(v))} bb`, "Cumulative"]}
              />
              <Line
                type="monotone"
                dataKey="cum_avg_bb"
                stroke="url(#premiumGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 8, fill: '#10b981', stroke: '#1a1a1a', strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <span>Loading analytics...</span>
        </div>
      )}

      <style jsx>{`
        /* ═══════════════════════════════════════════════════════════════════
           PREMIUM ANALYTICS - World-class Dashboard Design
           ═══════════════════════════════════════════════════════════════════ */
        
        .analytics-premium {
          min-height: 100vh;
          padding: 24px 32px;
          position: relative;
          background: #1c1c1c;
        }

        /* Subtle Background Pattern - matches other pages */
        .premium-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.4;
        }

        .bg-orb, .bg-orb-1, .bg-orb-2 {
          display: none;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.03) 0%, transparent 50%);
        }

        /* Premium Header */
        .premium-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .header-content {
          flex: 1;
        }

        .premium-title {
          font-size: 42px;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 8px 0;
          letter-spacing: -1px;
        }

        .premium-subtitle {
          font-size: 15px;
          color: #71717a;
          margin: 0;
          font-weight: 400;
        }

        .header-filters {
          display: flex;
          gap: 12px;
        }

        .premium-select {
          padding: 12px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          color: #e4e4e7;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
        }

        .premium-select:hover {
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
        }

        .premium-select option {
          background: #1a1a1a;
          color: #e4e4e7;
        }

        .premium-error {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          margin-bottom: 24px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 14px;
        }

        /* ═══════════════════════════════════════════════════════════════════
           HERO WINRATE CARD - The Star of the Show
           ═══════════════════════════════════════════════════════════════════ */
        
        .hero-section {
          position: relative;
          margin-bottom: 32px;
        }

        .hero-card {
          position: relative;
          padding: 40px 32px;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
          border-radius: 16px;
          text-align: center;
          overflow: hidden;
          border: 1px solid #333;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .hero-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 300px;
          height: 300px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
          opacity: 0.2;
          filter: blur(60px);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.35; transform: translate(-50%, -50%) scale(1.1); }
        }

        .hero-border {
          position: absolute;
          inset: 0;
          border-radius: 24px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 1;
        }

        .hero-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #71717a;
          margin-bottom: 12px;
        }

        .hero-value {
          font-size: 72px;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 8px;
          font-family: 'SF Pro Display', -apple-system, sans-serif;
          letter-spacing: -2px;
        }

        .hero-unit {
          font-size: 24px;
          font-weight: 500;
          opacity: 0.6;
          margin-left: 8px;
        }

        .hero-meta {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 16px;
          color: #71717a;
          font-size: 14px;
        }

        .hero-divider {
          opacity: 0.3;
        }

        /* ═══════════════════════════════════════════════════════════════════
           GLASS CARDS - Premium Glassmorphism
           ═══════════════════════════════════════════════════════════════════ */
        
        .glass-card {
          background: linear-gradient(145deg, #1e1e1e, #141414);
          border: 1px solid #333;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .glass-card:hover {
          border-color: #444;
          box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.4);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-item {
          padding: 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          font-size: 24px;
          flex-shrink: 0;
        }

        .stat-icon.trophy { background: rgba(34, 197, 94, 0.08); color: #4ade80; }
        .stat-icon.target { background: rgba(249, 115, 22, 0.08); color: #fb923c; }
        .stat-icon.leak { background: rgba(234, 179, 8, 0.08); color: #facc15; }

        .stat-info {
          flex: 1;
          min-width: 0;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #71717a;
          margin-bottom: 6px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 4px;
          letter-spacing: -0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-value.green { color: #22c55e; }
        .stat-value.orange { color: #f97316; }
        .stat-value.yellow { color: #eab308; }

        .stat-detail {
          font-size: 13px;
          color: #71717a;
        }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        .section-card {
          padding: 28px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
          color: #e4e4e7;
        }

        .title-icon {
          font-size: 18px;
        }

        .section-badge {
          font-size: 11px;
          font-weight: 600;
          color: #a1a1aa;
          padding: 6px 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 20px;
        }

        /* Position Chips */
        .positions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
          gap: 12px;
        }

        .position-chip {
          position: relative;
          padding: 20px 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          text-align: center;
          transition: all 0.25s ease;
          overflow: hidden;
        }

        .position-chip:hover {
          transform: translateY(-4px);
          border-color: var(--chip-color);
          box-shadow: 0 8px 30px -10px var(--chip-color);
        }

        .chip-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--chip-color);
          box-shadow: 0 0 20px var(--chip-color);
        }

        .chip-name {
          font-size: 15px;
          font-weight: 700;
          color: #e4e4e7;
          margin-bottom: 8px;
        }

        .chip-bb {
          font-size: 20px;
          font-weight: 800;
          color: var(--chip-color);
          margin-bottom: 4px;
          font-family: 'SF Mono', ui-monospace, monospace;
        }

        .chip-hands {
          font-size: 11px;
          color: #71717a;
        }

        /* Empty State */
        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: #52525b;
        }

        .empty-icon {
          font-size: 32px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 14px;
        }

        /* Insight Banner */
        .insight-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          padding: 16px 20px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 14px;
          font-size: 14px;
          color: #fcd34d;
        }

        .insight-banner strong {
          color: #fef08a;
        }

        .insight-bulb {
          font-size: 18px;
        }

        /* Leaks List */
        .leaks-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Chart Section */
        .chart-section {
          padding: 28px;
        }

        .chart-container {
          margin-top: 8px;
        }

        /* Loading Overlay */
        .loading-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          z-index: 1000;
          color: #a1a1aa;
          font-size: 14px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .analytics-premium {
            padding: 20px;
          }
          .premium-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-value {
            font-size: 48px;
          }
          .hero-unit {
            font-size: 18px;
          }
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .positions-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="stat-card platinum-inner-border">
      <div className="stat-header">
        <span className="stat-indicator" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-subtitle">{subtitle}</div>

      <style jsx>{`
        .stat-card {
          padding: 18px 20px;
          background: linear-gradient(145deg, #1e1e1e, #141414);
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .stat-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #6b7280;
        }

        .stat-value {
          font-size: 26px;
          font-weight: 800;
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }

        .stat-subtitle {
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

function LeakRow({ leak, rank }: { leak: LeakRow; rank: number }) {
  const isLoss = leak.bb < 0;
  const width = Math.min(Math.abs(leak.bb) * 15, 100);
  const color = isLoss ? colors.red : colors.green;

  return (
    <div className="leak-row">
      <div className="leak-rank">{rank}</div>
      <div className="leak-info">
        <div className="leak-name">{formatLeakName(leak.learning_tag)}</div>
        <div className="leak-bar-container">
          <div
            className="leak-bar"
            style={{ width: `${width}%`, background: color }}
          />
        </div>
      </div>
      <div className="leak-bb" style={{ color }}>
        {leak.bb >= 0 ? '+' : ''}{fmt(leak.bb)} bb
      </div>

      <style jsx>{`
        .leak-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #1a1a1a;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .leak-row:hover {
          background: #222;
        }

        .leak-rank {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #252525;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
        }

        .leak-info {
          flex: 1;
        }

        .leak-name {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 6px;
        }

        .leak-bar-container {
          height: 4px;
          background: #252525;
          border-radius: 2px;
          overflow: hidden;
        }

        .leak-bar {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .leak-bb {
          font-size: 14px;
          font-weight: 700;
          font-family: 'SF Mono', monospace;
          min-width: 70px;
          text-align: right;
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function formatLeakName(tag: string | null | undefined): string {
  if (!tag || tag === '{}' || tag === '[]' || tag.trim() === '') return "Unknown Leak";
  // Convert snake_case or kebab-case to Title Case
  return tag
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .slice(0, 25);
}
