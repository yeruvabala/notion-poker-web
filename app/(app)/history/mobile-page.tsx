'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import { UploadIcon } from '@/components/icons/ActionBarIcons';

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE HANDS PAGE - Premium Card-based Hand History
// ═══════════════════════════════════════════════════════════════════════════════

type Session = {
    id: string;
    name: string;
    created_at: string;
};

type Hand = {
    id: string;
    created_at: string;
    date: string | null;
    stakes: string | null;
    position: string | null;
    cards: string | null;
    board: string | null;
    gto_strategy: string | null;
    exploit_deviation: string | null;
    exploit_signals: any;
    hero_classification?: any;
    spr_analysis?: any;
    mistake_analysis?: any;
    session_id?: string | null;
    session?: { id: string; name: string } | null;
    source?: string | null;
    // NEW: Structured action data
    hand_actions?: {
        villain_position?: string | null;
        effective_stack?: string | null;
        table_format?: string | null;
        preflop?: Array<{ player: string; action: string; amount?: number }> | null;
        flop?: Array<{ player: string; action: string; amount?: number }> | null;
        turn?: Array<{ player: string; action: string; amount?: number }> | null;
        river?: Array<{ player: string; action: string; amount?: number }> | null;
    } | null;
};

type FilterType = 'all' | 'quick' | 'upload' | string;

// Render hero cards with bold text-forward design - no fake card shapes
// Shows "K♥ Q♦" style with large ranks and colorful glowing suits
function renderHeroCards(cards: string | null) {
    if (!cards) {
        return (
            <div className="hero-hand-display empty">
                <span className="hero-hand-placeholder">? ?</span>
            </div>
        );
    }

    const cardArray = cards.split(' ');

    return (
        <div className="hero-hand-display">
            {cardArray.map((card, i) => {
                const rank = card.slice(0, -1);
                const suit = card.slice(-1);
                const suitClass = suit === '♥' ? 'hearts' : suit === '♦' ? 'diamonds' : suit === '♣' ? 'clubs' : 'spades';

                return (
                    <div key={i} className={`hero-single-card ${suitClass}`}>
                        <span className="hero-rank">{rank}</span>
                        <span className="hero-suit">{suit}</span>
                    </div>
                );
            })}
        </div>
    );
}

// Relative time display
function getRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Render action timeline for a hand
function renderActionTimeline(hand: Hand) {
    const actions = hand.hand_actions;
    if (!actions) return null;

    const renderStreetActions = (streetName: string, streetActions: Array<{ player: string; action: string; amount?: number }> | null | undefined) => {
        if (!streetActions || streetActions.length === 0) return null;

        return (
            <div className="action-street" key={streetName}>
                <span className="action-street-name">{streetName}</span>
                <div className="action-chips">
                    {streetActions.map((act, i) => (
                        <span
                            key={i}
                            className={`action-chip ${act.player === 'H' ? 'hero' : 'villain'} ${act.action}`}
                        >
                            {act.player === 'H' ? '🅗' : '🅥'} {act.action}
                            {act.amount ? ` ${act.amount}bb` : ''}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="action-timeline">
            {/* Setup info */}
            {(actions.villain_position || actions.effective_stack) && (
                <div className="action-setup">
                    {actions.villain_position && <span>vs {actions.villain_position}</span>}
                    {actions.effective_stack && <span>{actions.effective_stack}bb deep</span>}
                </div>
            )}
            {/* Street actions */}
            {renderStreetActions('Preflop', actions.preflop)}
            {renderStreetActions('Flop', actions.flop)}
            {renderStreetActions('Turn', actions.turn)}
            {renderStreetActions('River', actions.river)}
        </div>
    );
}

export default function MobileHandsPage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hands, setHands] = useState<Hand[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [selectedHand, setSelectedHand] = useState<Hand | null>(null);

    // Upload state
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);

    // Session sheet state
    const [showSessionSheet, setShowSessionSheet] = useState(false);

    // Load hands from Supabase
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            const { data: { user }, error: userErr } = await supabase.auth.getUser();

            if (userErr || !user) {
                if (!cancelled) {
                    setError('Please sign in to view your hands.');
                    setLoading(false);
                }
                return;
            }

            const { data: handsData, error: handsErr } = await supabase
                .from('hands')
                .select('*, session:note_sessions(id, name)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);

            const { data: sessionsData } = await supabase
                .from('note_sessions')
                .select('id, name, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (handsErr) {
                if (!cancelled) {
                    setError('Failed to load hands.');
                    setLoading(false);
                }
                return;
            }

            if (!cancelled) {
                setHands((handsData || []) as Hand[]);
                setSessions((sessionsData || []) as Session[]);
                setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [supabase]);

    // Filter hands
    const filteredHands = useMemo(() => {
        if (activeFilter === 'all') return hands;
        if (activeFilter === 'quick') return hands.filter(h => h.source === 'quick_save');
        if (activeFilter === 'upload') return hands.filter(h => h.source === 'upload');
        return hands.filter(h => h.session_id === activeFilter || h.session?.id === activeFilter);
    }, [hands, activeFilter]);

    // Stats
    const stats = useMemo(() => ({
        total: hands.length,
        sessions: new Set(hands.map(h => h.session_id).filter(Boolean)).size,
    }), [hands]);

    // Handle hand tap
    const handleHandTap = (hand: Hand) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
        setSelectedHand(hand);
    };

    // Close modal
    const closeModal = () => {
        setSelectedHand(null);
    };

    // Upload handler - same as web page
    async function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadMsg(null);
        setUploadBusy(true);

        try {
            const { data: { user }, error: uerr } = await supabase.auth.getUser();
            if (uerr) throw new Error(`Auth error: ${uerr.message}`);
            if (!user) throw new Error('Please sign in.');

            const fd = new FormData();
            fd.append('file', file);

            const upRes = await fetch('/api/uploads/direct', { method: 'POST', body: fd });
            const upJson = await upRes.json().catch(() => ({}));
            if (!upRes.ok) throw new Error(upJson?.error || `Upload failed`);

            const { key, contentType } = upJson;
            const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET;
            if (!bucket) throw new Error('NEXT_PUBLIC_AWS_S3_BUCKET is not set.');

            const enqueueRes = await fetch('/api/hand-files/enqueue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storage_path: `s3://${bucket}/${key}`,
                    original_filename: file.name,
                    file_size_bytes: file.size,
                    mime_type: contentType || file.type
                }),
            });

            const enqueueJson = await enqueueRes.json().catch(() => ({}));
            if (!enqueueRes.ok || !enqueueJson?.ok) throw new Error(enqueueJson?.error || 'Enqueue failed');

            setUploadMsg('✓ Uploaded! New hands will appear soon.');
            e.target.value = '';
            // Haptic feedback
            if (Capacitor.isNativePlatform()) {
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
            }
        } catch (err: any) {
            console.error('upload error', err);
            setUploadMsg(`Error: ${err?.message || 'Upload failed'}`);
        } finally {
            setUploadBusy(false);
        }
    }

    // Get hand count per session
    const getSessionHandCount = (sessionId: string) => {
        return hands.filter(h => h.session_id === sessionId || h.session?.id === sessionId).length;
    };

    return (
        <div className="mobile-hands-page">
            {/* Premium Page Header */}
            <MobilePageHeader title="MY HANDS" />

            {/* Stats Bar with Upload */}
            <div className="mobile-hands-stats">
                <div className="mobile-stat">
                    <span className="mobile-stat-value">{stats.total}</span>
                    <span className="mobile-stat-label">hands</span>
                </div>
                <div className="mobile-stat-divider" />
                <div className="mobile-stat">
                    <span className="mobile-stat-value">{stats.sessions}</span>
                    <span className="mobile-stat-label">sessions</span>
                </div>
                <div className="mobile-stat-divider" />
                {/* Upload Button */}
                <label className={`mobile-upload-btn ${uploadBusy ? 'uploading' : ''}`}>
                    <input
                        type="file"
                        accept=".txt"
                        onChange={handleUploadChange}
                        disabled={uploadBusy}
                        style={{ display: 'none' }}
                    />
                    <UploadIcon className="upload-icon" size={16} />
                    <span className="upload-text">{uploadBusy ? 'Uploading…' : 'Upload'}</span>
                </label>
            </div>

            {/* Upload Message */}
            {uploadMsg && (
                <div className={`mobile-upload-msg ${uploadMsg.startsWith('Error') ? 'error' : 'success'}`}>
                    {uploadMsg}
                </div>
            )}

            {/* Filter Pills - Smart layout */}
            <div className="mobile-hands-filters">
                <button
                    className={`mobile-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                >
                    All
                </button>
                {/* Show first 2 sessions inline */}
                {sessions.slice(0, 2).map(s => (
                    <button
                        key={s.id}
                        className={`mobile-filter-pill ${activeFilter === s.id ? 'active' : ''}`}
                        onClick={() => setActiveFilter(s.id)}
                    >
                        {s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name}
                    </button>
                ))}
                {/* More button if 3+ sessions */}
                {sessions.length > 2 && (
                    <button
                        className={`mobile-filter-pill more-pill ${showSessionSheet ? 'active' : ''}`}
                        onClick={() => setShowSessionSheet(true)}
                    >
                        ▼ More
                    </button>
                )}
                <button
                    className={`mobile-filter-pill ${activeFilter === 'quick' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('quick')}
                >
                    ⚡ Quick
                </button>
            </div>

            {/* Content */}
            <div className="mobile-hands-content">
                {loading && (
                    <div className="mobile-hands-loading">Loading hands...</div>
                )}

                {error && !loading && (
                    <div className="mobile-hands-error">{error}</div>
                )}

                {!loading && !error && filteredHands.length === 0 && (
                    <div className="mobile-hands-empty">
                        <div className="empty-icon">🃏</div>
                        <div className="empty-title">No hands yet</div>
                        <div className="empty-subtitle">
                            Analyze hands from the Home tab and they&apos;ll appear here
                        </div>
                    </div>
                )}

                {!loading && !error && filteredHands.length > 0 && (
                    <div className="mobile-hands-list">
                        {filteredHands.map((hand) => {
                            const hasGto = !!hand.gto_strategy;
                            const timeAgo = getRelativeTime(hand.created_at);

                            return (
                                <div
                                    key={hand.id}
                                    className="mobile-hand-card"
                                    onClick={() => handleHandTap(hand)}
                                >
                                    {/* Left: Premium Hero Cards */}
                                    <div className="mobile-hand-cards">
                                        {renderHeroCards(hand.cards)}
                                    </div>

                                    {/* Center: Compact Position + Time */}
                                    <div className="mobile-hand-info">
                                        <div className="mobile-info-row">
                                            <span className={`mobile-position-badge ${(hand.position || 'unknown').toLowerCase()}`}>
                                                {hand.position || '?'}
                                            </span>
                                            <span className="mobile-hand-time">— {timeAgo}</span>
                                        </div>
                                    </div>

                                    {/* Right: GTO Status */}
                                    <div className="mobile-hand-status">
                                        {hasGto ? (
                                            <div className="mobile-gto-indicator">
                                                <span className="gto-dot"></span>
                                                <span className="gto-text">GTO</span>
                                            </div>
                                        ) : (
                                            <div className="mobile-pending-indicator">
                                                <span className="pending-dot"></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Hand Detail Modal */}
            {selectedHand && (
                <div className="mobile-hand-modal-overlay" onClick={closeModal}>
                    <div className="mobile-hand-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="mobile-modal-header">
                            <div className="mobile-modal-cards">
                                {renderHeroCards(selectedHand.cards)}
                            </div>
                            <button className="mobile-modal-close" onClick={closeModal}>
                                ✕
                            </button>
                        </div>

                        {/* Modal Meta */}
                        <div className="mobile-modal-meta">
                            <span className="mobile-modal-position">{selectedHand.position}</span>
                            {selectedHand.hand_actions?.villain_position && (
                                <span className="mobile-modal-vs">vs {selectedHand.hand_actions.villain_position}</span>
                            )}
                            <span className="mobile-modal-stakes">{selectedHand.stakes || '—'}</span>
                            <span className="mobile-modal-date">
                                {selectedHand.date || selectedHand.created_at?.slice(0, 10)}
                            </span>
                        </div>

                        {/* Board Display */}
                        {selectedHand.board && (
                            <div className="mobile-modal-board">
                                <span className="board-label">Board:</span> {selectedHand.board}
                            </div>
                        )}

                        {/* Session Badge */}
                        {selectedHand.session?.name && (
                            <div className="mobile-modal-session">
                                📁 {selectedHand.session.name}
                            </div>
                        )}

                        {/* Hand Actions Timeline - Shows what user played */}
                        {selectedHand.hand_actions && (
                            <div className="mobile-modal-section">
                                <div className="mobile-modal-section-title">🎲 Hand Actions</div>
                                <div className="mobile-modal-section-body">
                                    {renderActionTimeline(selectedHand)}
                                </div>
                            </div>
                        )}

                        {/* GTO Strategy */}
                        {selectedHand.gto_strategy && (
                            <div className="mobile-modal-section">
                                <div className="mobile-modal-section-title">🤖 GTO Strategy</div>
                                <div className="mobile-modal-section-body">
                                    {selectedHand.gto_strategy}
                                </div>
                            </div>
                        )}

                        {/* Exploit Signals */}
                        {selectedHand.exploit_signals && selectedHand.exploit_signals.length > 0 && (
                            <div className="mobile-modal-section">
                                <div className="mobile-modal-section-title">🎯 Exploit Signals</div>
                                <div className="mobile-modal-section-body">
                                    {selectedHand.exploit_signals.map((sig: any, i: number) => (
                                        <div key={i} className="mobile-exploit-item">
                                            <span className="mobile-exploit-icon">{sig.icon}</span>
                                            <span>{sig.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Play Review */}
                        {selectedHand.exploit_deviation && (
                            <div className="mobile-modal-section">
                                <div className="mobile-modal-section-title">👤 Play Review</div>
                                <div className="mobile-modal-section-body">
                                    {selectedHand.exploit_deviation}
                                </div>
                            </div>
                        )}

                        {/* No Analysis - only show if no actions AND no GTO */}
                        {!selectedHand.gto_strategy && !selectedHand.exploit_deviation && !selectedHand.hand_actions && (
                            <div className="mobile-modal-empty">
                                No analysis or actions saved yet.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Session Selection Bottom Sheet */}
            {showSessionSheet && (
                <div className="session-sheet-overlay" onClick={() => setShowSessionSheet(false)}>
                    <div className="session-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="session-sheet-header">
                            <span className="session-sheet-title">Select Session</span>
                            <button className="session-sheet-close" onClick={() => setShowSessionSheet(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="session-sheet-list">
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    className={`session-sheet-item ${activeFilter === s.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveFilter(s.id);
                                        setShowSessionSheet(false);
                                        if (Capacitor.isNativePlatform()) {
                                            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                        }
                                    }}
                                >
                                    <span className="session-item-name">{s.name}</span>
                                    <span className="session-item-count">{getSessionHandCount(s.id)} hands</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <MobileBottomNav />
        </div>
    );
}
