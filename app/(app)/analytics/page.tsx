"use client";

import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "@/styles/onlypoker-theme.css";
import MobileAnalyticsPage from "./mobile-page";
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
    <div className="analytics-page op-surface">
      <div className="dashboard-bg-pattern" />

      {/* Header */}
      <header className="analytics-header">
        <div className="header-left">
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">Performance insights & leak detection</p>
        </div>
        <div className="header-filters">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="filter-select"
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
            className="filter-select"
          >
            {["2NL", "5NL", "10NL", "25NL", "50NL", "100NL", "200NL"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div className="error-banner platinum-inner-border">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Hero Stats Row */}
      <section className="stats-row">
        <StatCard
          label="Winrate"
          value={`${fmt(overview?.winrate_bb ?? 0)} bb/100`}
          subtitle={`${overview?.total_hands ?? 0} hands`}
          color={getWinrateColor(overview?.winrate_bb ?? 0)}
        />
        <StatCard
          label="Best Position"
          value={bestPosition?.pos ?? "—"}
          subtitle={bestPosition ? `+${fmt(bestPosition.bb)} bb/hand` : "0 hands"}
          color={colors.green}
        />
        <StatCard
          label="Weakest Position"
          value={overview?.weakest_seat ?? "—"}
          subtitle={`${fmt(overview?.weakest_bb ?? 0)} bb/hand`}
          color={colors.red}
        />
        <StatCard
          label="Primary Leak"
          value={formatLeakName(overview?.primary_leak)}
          subtitle={`${fmt(overview?.primary_leak_bb ?? 0)} bb impact`}
          color={colors.yellow}
        />
      </section>

      {/* Main Grid */}
      <div className="analytics-grid">
        {/* Position Performance */}
        <section className="grid-section position-section platinum-inner-border">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-indicator" style={{ background: colors.blue }} />
              Position Performance
            </h2>
          </div>
          <div className="position-grid">
            {seatDial.length > 0 ? (
              seatDial.map((seat) => (
                <div
                  key={seat.pos}
                  className={`position-card ${seat.bb >= 0 ? 'profitable' : 'losing'}`}
                  style={{ '--pos-color': getPositionColor(seat.bb) } as React.CSSProperties}
                >
                  <div className="pos-indicator" />
                  <div className="pos-name">{seat.pos}</div>
                  <div className="pos-bb">{seat.bb >= 0 ? '+' : ''}{fmt(seat.bb)}</div>
                  <div className="pos-hands">{seat.n} hands</div>
                </div>
              ))
            ) : (
              <div className="empty-positions">
                <span>Play some hands to see position stats</span>
              </div>
            )}
          </div>
          {worstPosition && worstPosition.bb < 0 && (
            <div className="position-insight">
              <span className="insight-icon">💡</span>
              <span className="insight-text">
                Focus on improving your <strong>{worstPosition.pos}</strong> play.
                You're losing {fmt(Math.abs(worstPosition.bb))} bb/hand there.
              </span>
            </div>
          )}
        </section>

        {/* Top Leaks */}
        <section className="grid-section leaks-section platinum-inner-border">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-indicator" style={{ background: colors.red }} />
              Top Leaks
            </h2>
          </div>
          <div className="leaks-list">
            {leaks.slice(0, 5).map((leak, idx) => (
              <LeakRow key={leak.learning_tag} leak={leak} rank={idx + 1} />
            ))}
            {!leaks.length && (
              <div className="empty-leaks">
                <span>No significant leaks detected</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Trend Chart */}
      <section className="trend-section platinum-inner-border">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-indicator" style={{ background: colors.green }} />
            Performance Trend
          </h2>
          <span className="section-badge">Last 200 hands</span>
        </div>
        <div className="trend-chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors.blue} />
                  <stop offset="100%" stopColor={colors.green} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis
                dataKey="hand_date"
                stroke="#6b7280"
                tickFormatter={(v) => v.slice(5)}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
              />
              <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="5 5" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e1e1e',
                  borderColor: '#333',
                  borderRadius: '10px',
                  padding: '12px'
                }}
                labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                formatter={(v: any) => [`${fmt(Number(v))} bb`, "Cumulative"]}
              />
              <Line
                type="monotone"
                dataKey="cum_avg_bb"
                stroke="url(#lineGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: colors.green, stroke: '#1a1a1a', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {loading && <div className="loading-indicator">Loading analytics data…</div>}

      <style jsx>{`
        .analytics-page {
          min-height: 100vh;
          padding: 24px 32px;
          position: relative;
        }

        /* Header */
        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
        }

        .analytics-title {
          font-size: 36px;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #a3a3a3 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 4px;
        }

        .analytics-subtitle {
          font-size: 14px;
          color: #6b7280;
        }

        .header-filters {
          display: flex;
          gap: 12px;
        }

        .filter-select {
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid #333;
          background: linear-gradient(145deg, #1e1e1e, #141414);
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.15s ease;
        }

        .filter-select:hover {
          border-color: #505050;
          background: #1e1e1e;
        }

        .filter-select option {
          background: #1a1a1a;
        }

        /* Error Banner */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          margin-bottom: 20px;
          background: linear-gradient(145deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
          border-color: rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5;
          font-size: 14px;
        }

        /* Stats Row */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Main Grid */
        .analytics-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .grid-section {
          padding: 20px;
          background: linear-gradient(145deg, #1e1e1e, #141414);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-indicator {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
          box-shadow: 0 0 6px currentColor;
        }

        .section-badge {
          font-size: 11px;
          color: #6b7280;
          padding: 4px 10px;
          background: #252525;
          border-radius: 20px;
        }

        /* Position Grid - flexible for 6-max or 9-handed */
        .position-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 10px;
        }

        .position-card {
          padding: 16px 12px;
          background: #1a1a1a;
          border-radius: 10px;
          text-align: center;
          transition: all 0.2s ease;
          border: 1px solid #2a2a2a;
          position: relative;
          overflow: hidden;
        }

        .position-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--pos-color);
        }

        .position-card:hover {
          transform: translateY(-2px);
          border-color: #3a3a3a;
        }

        .pos-name {
          font-size: 14px;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 6px;
        }

        .pos-bb {
          font-size: 18px;
          font-weight: 800;
          color: var(--pos-color);
          margin-bottom: 4px;
          font-family: 'SF Mono', monospace;
        }

        .pos-hands {
          font-size: 10px;
          color: #6b7280;
        }

        .empty-positions {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: #6b7280;
          font-size: 14px;
        }

        .empty-positions .empty-icon {
          font-size: 24px;
        }

        .position-insight {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(234, 179, 8, 0.1);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 8px;
          font-size: 13px;
          color: #fcd34d;
        }

        .insight-icon {
          font-size: 16px;
        }

        .insight-text strong {
          color: #fde68a;
        }

        /* Leaks List */
        .leaks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .empty-leaks {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: #6b7280;
          font-size: 14px;
        }

        .empty-icon {
          font-size: 20px;
        }

        /* Trend Section */
        .trend-section {
          padding: 20px;
          background: linear-gradient(145deg, #1e1e1e, #141414);
        }

        .trend-chart {
          margin-top: 10px;
        }

        /* Loading */
        .loading-indicator {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-size: 13px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
          .analytics-grid {
            grid-template-columns: 1fr;
          }
          .position-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .analytics-page {
            padding: 16px;
          }
          .analytics-header {
            flex-direction: column;
            gap: 16px;
          }
          .stats-row {
            grid-template-columns: 1fr;
          }
          .position-grid {
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
