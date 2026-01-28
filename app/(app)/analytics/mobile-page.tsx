'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { TrophyIcon, TargetIcon } from '@/components/icons/StudyIcons';

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

// Color helpers - Premium theme aligned
// Using: Emerald green for positive, platinum/white for neutral, red for negative
function getWinrateColor(bb: number): string {
    if (bb >= 2) return '#10b981';     // Emerald green for strong win
    if (bb >= 0) return '#e5e7eb';     // Platinum/light gray for break-even to small win
    return '#ef4444';                   // Red for losing
}

function getPositionColor(bb: number): string {
    if (bb >= 1) return '#10b981';     // Emerald green for winning
    if (bb >= 0) return '#a5b4fc';     // Soft indigo/purple for break-even (matches app accents)
    return '#ef4444';                   // Red for losing
}

function fmt(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2);
}

function formatLeakName(tag: string | null | undefined): string {
    if (!tag || tag === '{}' || tag === '[]' || tag.trim() === '') return 'Unknown Leak';

    // Remove surrounding braces/brackets and clean up
    let cleaned = tag
        .replace(/^[\{\[\"\']/, '')  // Remove leading {, [, ", '
        .replace(/[\}\]\"\']$/, '')  // Remove trailing }, ], ", '
        .trim();

    if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return 'Unknown Leak';

    // Format nicely: replace underscores/dashes with spaces, capitalize each word
    return cleaned
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 25);
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
                    {/* ═══════════════════════════════════════════════════════════════════
                        HERO STAT CARD - Win Rate as THE star
                        ═══════════════════════════════════════════════════════════════════ */}
                    <div className="analytics-hero-card">
                        <div className="hero-glow" />
                        <div className="hero-label">WIN RATE</div>
                        <div className="hero-value" style={{ color: getWinrateColor(winrate) }}>
                            {winrate >= 0 ? '+' : ''}{fmt(winrate)}
                        </div>
                        <div className="hero-unit">bb/100</div>
                        <div className="hero-secondary">
                            <span>{totalHands.toLocaleString()} hands</span>
                            <span className="hero-dot">•</span>
                            <span>{seats.length} positions</span>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════════
                        QUICK INSIGHTS ROW - Best Position + Focus Area
                        ═══════════════════════════════════════════════════════════════════ */}
                    <div className="analytics-insights-row">
                        {/* Best Position - Green */}
                        <div className="insight-card success">
                            <div className="insight-icon">
                                <TrophyIcon size={22} />
                            </div>
                            <div className="insight-content">
                                <div className="insight-label">BEST POSITION</div>
                                <div className="insight-value">{bestPosition?.hero_position ?? '—'}</div>
                                <div className="insight-detail">
                                    {bestPosition ? `+${fmt(bestPosition.bb)} bb` : 'No data'}
                                </div>
                            </div>
                        </div>

                        {/* Focus Area - Orange (weakest position) */}
                        <div className="insight-card warning">
                            <div className="insight-icon">
                                <TargetIcon size={22} />
                            </div>
                            <div className="insight-content">
                                <div className="insight-label">FOCUS AREA</div>
                                <div className="insight-value">{overview?.weakest_seat ?? '—'}</div>
                                <div className="insight-detail">
                                    {overview?.weakest_seat ? `${fmt(overview.weakest_bb ?? 0)} bb` : 'No data'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════════
                        POSITION BREAKDOWN - Horizontal scroll
                        ═══════════════════════════════════════════════════════════════════ */}
                    <section className="analytics-section">
                        <div className="section-header">
                            <span className="section-title">Position Breakdown</span>
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

                    {/* ═══════════════════════════════════════════════════════════════════
                        LEAKS TO FIX - Ranked list with progress bars
                        ═══════════════════════════════════════════════════════════════════ */}
                    <section className="analytics-section">
                        <div className="section-header">
                            <span className="section-title">Leaks to Fix</span>
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
                            <span className="insight-text">
                                💡 Focus on your <strong>{overview.weakest_seat}</strong> play. You're losing{' '}
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
