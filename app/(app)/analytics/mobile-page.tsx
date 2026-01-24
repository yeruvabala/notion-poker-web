'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE ANALYTICS PAGE - Premium Performance Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

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

const STAKES_OPTIONS = ['All', '2NL', '5NL', '10NL', '25NL', '50NL', '100NL', '200NL'];

// Color helpers
function getWinrateColor(bb: number): string {
    if (bb >= 2) return '#22c55e';
    if (bb >= 0) return '#eab308';
    return '#ef4444';
}

function getPositionColor(bb: number): string {
    if (bb >= 1) return '#22c55e';
    if (bb >= 0) return '#eab308';
    return '#ef4444';
}

function fmt(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2);
}

function formatLeakName(tag: string | null | undefined): string {
    if (!tag) return '—';
    return tag
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 20);
}

export default function MobileAnalyticsPage() {
    const [month, setMonth] = useState<string>('all');
    const [stakes, setStakes] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [overview, setOverview] = useState<Overview | null>(null);
    const [seats, setSeats] = useState<SeatRow[]>([]);
    const [leaks, setLeaks] = useState<LeakRow[]>([]);

    // Haptic feedback
    const haptic = (style: ImpactStyle = ImpactStyle.Light) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style }).catch(() => { });
        }
    };

    // Fetch analytics data
    useEffect(() => {
        setLoading(true);
        setError(null);

        // Build query params - only include if not 'all'
        const params = new URLSearchParams();
        if (month !== 'all') params.set('month', month);
        if (stakes !== 'All') params.set('stakes', stakes);

        fetch(`/api/analytics?${params.toString()}`)
            .then(r => r.json())
            .then(json => {
                if (json.error) throw new Error(json.error);
                setOverview(json.overview);
                setSeats(json.seats || []);
                setLeaks(json.leaks || []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [month, stakes]);

    // Get best position
    const bestPosition = useMemo(() => {
        if (!seats.length) return null;
        return seats.reduce((best, curr) => curr.bb > best.bb ? curr : best, seats[0]);
    }, [seats]);

    // Generate month options with All Time first
    const monthOptions = useMemo(() => {
        const months = Array.from({ length: 24 }).map((_, i) => {
            const d = new Date();
            d.setUTCMonth(d.getUTCMonth() - i);
            return {
                value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
            };
        });
        return [{ value: 'all', label: 'All Time' }, ...months];
    }, []);

    const winrate = overview?.winrate_bb ?? 0;
    const totalHands = overview?.total_hands ?? 0;

    return (
        <div className="mobile-analytics-page">
            <MobilePageHeader title="ANALYTICS" />

            {/* Filter Section */}
            <div className="analytics-filters">
                <select
                    className="analytics-filter-select"
                    value={month}
                    onChange={(e) => { haptic(); setMonth(e.target.value); }}
                >
                    {monthOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <select
                    className="analytics-filter-select"
                    value={stakes}
                    onChange={(e) => { haptic(); setStakes(e.target.value); }}
                >
                    {STAKES_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="analytics-loading">
                    <div className="loading-spinner" />
                    <span>Loading analytics...</span>
                </div>
            )}

            {error && (
                <div className="analytics-error">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* Hero Stats - Horizontal Scroll */}
                    <div className="analytics-stats-scroll">
                        <div className="stats-scroll-inner">
                            {/* Win Rate - Large Feature Card */}
                            <div className="stat-card stat-card-hero" style={{ '--stat-color': getWinrateColor(winrate) } as React.CSSProperties}>
                                <div className="stat-glow" />
                                <div className="stat-label">WIN RATE</div>
                                <div className="stat-value-large">{fmt(winrate)}</div>
                                <div className="stat-unit">bb/100</div>
                                <div className="stat-subtitle">{totalHands.toLocaleString()} hands</div>
                            </div>

                            {/* Total Hands */}
                            <div className="stat-card" style={{ '--stat-color': '#3b82f6' } as React.CSSProperties}>
                                <div className="stat-label">TOTAL HANDS</div>
                                <div className="stat-value">{totalHands.toLocaleString()}</div>
                                <div className="stat-detail">analyzed</div>
                            </div>

                            {/* Best Position */}
                            <div className="stat-card" style={{ '--stat-color': '#22c55e' } as React.CSSProperties}>
                                <div className="stat-label">BEST POSITION</div>
                                <div className="stat-value">{bestPosition?.hero_position ?? '—'}</div>
                                <div className="stat-detail">{bestPosition ? `+${fmt(bestPosition.bb)} bb` : 'No data'}</div>
                            </div>

                            {/* Weakest Position */}
                            <div className="stat-card" style={{ '--stat-color': '#ef4444' } as React.CSSProperties}>
                                <div className="stat-label">WEAKEST SPOT</div>
                                <div className="stat-value">{overview?.weakest_seat ?? '—'}</div>
                                <div className="stat-detail">{overview?.weakest_seat ? `${fmt(overview.weakest_bb ?? 0)} bb` : 'No data'}</div>
                            </div>

                            {/* Primary Leak */}
                            <div className="stat-card" style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
                                <div className="stat-label">TOP LEAK</div>
                                <div className="stat-value-sm">{formatLeakName(overview?.primary_leak) || '—'}</div>
                                <div className="stat-detail">{overview?.primary_leak ? `${fmt(overview.primary_leak_bb ?? 0)} bb` : 'No data'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Position Performance */}
                    <section className="analytics-section">
                        <div className="section-header">
                            <span className="section-icon" style={{ background: '#3b82f6' }} />
                            <span className="section-title">Position Performance</span>
                        </div>

                        <div className="position-scroll">
                            <div className="position-scroll-inner">
                                {seats.length > 0 ? (
                                    seats.map(seat => (
                                        <div
                                            key={seat.hero_position}
                                            className="position-card"
                                            style={{ '--pos-color': getPositionColor(seat.bb) } as React.CSSProperties}
                                        >
                                            <div className="pos-indicator" />
                                            <div className="pos-name">{seat.hero_position}</div>
                                            <div className="pos-bb">
                                                {seat.bb >= 0 ? '+' : ''}{fmt(seat.bb)}
                                            </div>
                                            <div className="pos-hands">{seat.n} hands</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <span>📊</span>
                                        <span>Play hands to see position stats</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Top Leaks */}
                    <section className="analytics-section">
                        <div className="section-header">
                            <span className="section-icon" style={{ background: '#ef4444' }} />
                            <span className="section-title">Top Leaks</span>
                            {leaks.length > 0 && (
                                <span className="section-badge">{leaks.length} found</span>
                            )}
                        </div>

                        <div className="leaks-list">
                            {leaks.length > 0 ? (
                                leaks.slice(0, 5).map((leak, idx) => {
                                    const isLoss = leak.bb < 0;
                                    const barWidth = Math.min(Math.abs(leak.bb) * 15, 100);
                                    const color = isLoss ? '#ef4444' : '#22c55e';

                                    return (
                                        <div key={leak.learning_tag} className="leak-card">
                                            <div className="leak-rank">{idx + 1}</div>
                                            <div className="leak-info">
                                                <div className="leak-name">{formatLeakName(leak.learning_tag)}</div>
                                                <div className="leak-bar-bg">
                                                    <div
                                                        className="leak-bar-fill"
                                                        style={{ width: `${barWidth}%`, background: color }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="leak-bb" style={{ color }}>
                                                {leak.bb >= 0 ? '+' : ''}{fmt(leak.bb)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="empty-state">
                                    <span>✅</span>
                                    <span>No significant leaks detected</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Quick Insights */}
                    {overview?.weakest_seat && (overview?.weakest_bb ?? 0) < 0 && (
                        <section className="analytics-insight">
                            <span className="insight-icon">💡</span>
                            <span className="insight-text">
                                Focus on your <strong>{overview.weakest_seat}</strong> play. You're losing{' '}
                                <strong>{fmt(Math.abs(overview.weakest_bb ?? 0))} bb/hand</strong> there.
                            </span>
                        </section>
                    )}
                </>
            )}

            <MobileBottomNav />
        </div>
    );
}
