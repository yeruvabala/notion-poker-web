
// app/(app)/history/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { Bot, User, Target, Upload, Zap, FolderOpen, Clock, Layers, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import MobileHandsPage from './mobile-page';
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";

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
  // Structured action data
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

// Large card rendering with proper suit colors
function renderHeroCards(cards: string | null, size: 'normal' | 'large' = 'normal') {
  if (!cards) return <span className="hand-card-empty">—</span>;
  return cards.split(' ').map((card, i) => {
    const suit = card.slice(-1);
    const isRed = suit === '♥' || suit === '♦';
    return (
      <span key={i} className={`hero-card ${isRed ? 'red' : 'black'} ${size === 'large' ? 'large' : ''}`}>
        {card}
      </span>
    );
  });
}

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

// Simple markdown bolding
function renderMarkdown(text: string | null) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Render action timeline for a hand
function renderActionTimeline(hand: Hand) {
  const actions = hand.hand_actions;
  if (!actions) return null;

  const renderStreetActions = (streetName: string, streetActions: Array<{ player: string; action: string; amount?: number }> | null | undefined) => {
    if (!streetActions || streetActions.length === 0) return null;
    return (
      <div className="web-action-street" key={streetName}>
        <span className="web-action-street-name">{streetName}</span>
        <div className="web-action-chips">
          {streetActions.map((act, i) => (
            <span key={i} className={`web-action-chip ${act.player === 'H' ? 'hero' : 'villain'}`}>
              {act.player === 'H' ? '🅗' : '🅥'} {act.action}{act.amount ? ` ${act.amount}bb` : ''}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="web-action-timeline">
      {(actions.villain_position || actions.effective_stack) && (
        <div className="web-action-setup">
          {actions.villain_position && <span>vs {actions.villain_position}</span>}
          {actions.effective_stack && <span>{actions.effective_stack}bb deep</span>}
        </div>
      )}
      {renderStreetActions('Preflop', actions.preflop)}
      {renderStreetActions('Flop', actions.flop)}
      {renderStreetActions('Turn', actions.turn)}
      {renderStreetActions('River', actions.river)}
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  // Prevent hydration mismatch - only render after client-side hydration
  const [mounted, setMounted] = useState(false);
  const [isNative, setIsNative] = useState(false);

  // All hooks must be declared before any conditional returns
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hands, setHands] = useState<Hand[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const [selectedHand, setSelectedHand] = useState<Hand | null>(null);

  // Detect native platform after mount to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // For native app, render mobile version
  if (isNative) {
    return <MobileHandsPage />;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        console.error(userErr);
        if (!cancelled) { setErr('Could not load user session.'); setLoading(false); }
        return;
      }

      if (!user) { if (!cancelled) router.push('/'); return; }

      const { data: handsData, error: handsErr } = await supabase
        .from('hands')
        .select('*, session:note_sessions(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: sessionsData } = await supabase
        .from('note_sessions')
        .select('id, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (handsErr) {
        console.error(handsErr);
        if (!cancelled) { setErr('Failed to load hands.'); setLoading(false); }
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
  }, [router, supabase]);

  const filteredHands = useMemo(() => {
    if (activeFilter === 'all') return hands;
    if (activeFilter === 'quick') return hands.filter(h => h.source === 'quick_save');
    if (activeFilter === 'upload') return hands.filter(h => h.source === 'upload');
    return hands.filter(h => h.session_id === activeFilter || h.session?.id === activeFilter);
  }, [hands, activeFilter]);

  const stats = useMemo(() => {
    const uniqueSessions = new Set(hands.map(h => h.session_id).filter(Boolean));
    const lastHand = hands[0];
    return {
      total: hands.length,
      sessionCount: uniqueSessions.size,
      lastActivity: lastHand ? getRelativeTime(lastHand.created_at) : '—'
    };
  }, [hands]);

  async function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    setUploadBusy(true);

    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw new Error(`Supabase getUser error: ${uerr.message}`);
      if (!user) throw new Error('Please sign in.');

      const fd = new FormData();
      fd.append('file', file);

      const upRes = await fetch('/api/uploads/direct', { method: 'POST', body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) throw new Error(upJson?.error || `Upload failed with status ${upRes.status}`);

      const { key, contentType } = upJson;
      const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET;
      if (!bucket) throw new Error('NEXT_PUBLIC_AWS_S3_BUCKET is not set.');

      const enqueueRes = await fetch('/api/hand-files/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: `s3://${bucket}/${key}`, original_filename: file.name, file_size_bytes: file.size, mime_type: contentType || file.type }),
      });

      const enqueueJson = await enqueueRes.json().catch(() => ({}));
      if (!enqueueRes.ok || !enqueueJson?.ok) throw new Error(enqueueJson?.error || `Enqueue failed`);

      setUploadMsg('✓ Uploaded! New hands will appear soon.');
      e.target.value = '';
    } catch (error: any) {
      console.error('upload error', error);
      setUploadMsg(`Error: ${error?.message || 'Upload failed'}`);
    } finally {
      setUploadBusy(false);
    }
  }

  // Handle card click - open modal instead of navigating
  const handleCardClick = (h: Hand, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedHand(h);
  };

  return (
    <main className="op-surface mh-page">
      <div className="mh-container">
        {/* Header */}
        <header className="mh-header">
          <h1 className="mh-title platinum-text-gradient">My Hands</h1>
          <p className="mh-subtitle">Your poker hand history with GTO analysis and coaching insights.</p>
        </header>

        {/* Filter Bar */}
        <section className="mh-filter-bar">
          <button className={`mh-filter-pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
            <Layers className="w-4 h-4" /> All Hands
          </button>
          {sessions.map(s => (
            <button key={s.id} className={`mh-filter-pill ${activeFilter === s.id ? 'active' : ''}`} onClick={() => setActiveFilter(s.id)}>
              <FolderOpen className="w-4 h-4" /> {s.name}
            </button>
          ))}
          <button className={`mh-filter-pill ${activeFilter === 'quick' ? 'active' : ''}`} onClick={() => setActiveFilter('quick')}>
            <Zap className="w-4 h-4" /> Quick Saves
          </button>
          <button className={`mh-filter-pill ${activeFilter === 'upload' ? 'active' : ''}`} onClick={() => setActiveFilter('upload')}>
            <Upload className="w-4 h-4" /> Uploads
          </button>
        </section>

        {/* Stats Bar + Upload Toggle */}
        <section className="mh-stats-upload-row">
          <div className="mh-stats-bar platinum-inner-border">
            <div className="mh-stat">
              <span className="mh-stat-value">{stats.total}</span>
              <span className="mh-stat-label">hands</span>
            </div>
            <div className="mh-stat-divider" />
            <div className="mh-stat">
              <span className="mh-stat-value">{stats.sessionCount}</span>
              <span className="mh-stat-label">sessions</span>
            </div>
            <div className="mh-stat-divider" />
            <div className="mh-stat">
              <Clock className="w-4 h-4 opacity-60" />
              <span className="mh-stat-label">Last: {stats.lastActivity}</span>
            </div>
          </div>

          <button className="mh-upload-toggle" onClick={() => setUploadExpanded(!uploadExpanded)}>
            <Upload className="w-4 h-4" />
            Import
            {uploadExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </section>

        {/* Collapsible Upload Section */}
        {uploadExpanded && (
          <section className="mh-upload platinum-container-frame">
            <div className="mh-upload-content">
              <div>
                <div className="mh-upload-title">📂 Import Hand History</div>
                <div className="mh-upload-sub">Drag & drop or click to upload .txt files from your poker client</div>
              </div>
              <label className="mh-upload-btn btn-platinum-premium">
                <input type="file" accept=".txt" onChange={handleUploadChange} disabled={uploadBusy} style={{ display: 'none' }} />
                {uploadBusy ? 'Uploading…' : 'Choose File'}
              </label>
            </div>
            {uploadMsg && <div className="mh-upload-msg">{uploadMsg}</div>}
          </section>
        )}

        {/* Loading / Error States */}
        {loading && <div className="mh-loading">Loading hands…</div>}
        {err && !loading && <div className="mh-error">{err}</div>}

        {/* Hand Cards Grid */}
        {!loading && !err && (
          <>
            {filteredHands.length === 0 ? (
              <div className="mh-empty">{activeFilter === 'all' ? 'No hands found yet. Upload a .txt history file or save hands from the Hand Builder.' : 'No hands match this filter.'}</div>
            ) : (
              <section className="mh-hands-grid">
                {filteredHands.map((h) => {
                  const hasGto = !!h.gto_strategy;
                  const hasExploit = h.exploit_signals && h.exploit_signals.length > 0;
                  const hasReview = !!h.exploit_deviation;
                  const dateStr = h.date || h.created_at?.slice(0, 10);

                  return (
                    <div key={h.id} className="mh-hand-card platinum-inner-border" onClick={(e) => handleCardClick(h, e)}>
                      <div className="mh-card-top">
                        <div className="mh-hero-cards">{renderHeroCards(h.cards)}</div>
                        {h.position && <span className="mh-position-badge">{h.position}</span>}
                      </div>

                      <div className="mh-card-meta">
                        <span className="mh-stakes">{h.stakes || '—'}</span>
                        <span className="mh-date">{dateStr || '—'}</span>
                      </div>

                      <div className="mh-card-footer">
                        {/* GTO Icon with Tooltip */}
                        <div className="mh-status-wrapper group">
                          <div className={`mh-status-icon ${hasGto ? 'active' : ''}`}>
                            <Bot className="w-4 h-4" />
                          </div>
                          {hasGto && (
                            <div className="mh-tooltip platinum-container-frame">
                              <div className="mh-tooltip-header">
                                <span className="gto-inline-icon">
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="6" />
                                    <circle cx="12" cy="12" r="2" />
                                  </svg>
                                </span>
                                GTO Strategy
                              </div>
                              <div className="mh-tooltip-body">{h.gto_strategy?.slice(0, 200)}...</div>
                            </div>
                          )}
                        </div>

                        {/* Exploit Icon with Tooltip */}
                        <div className="mh-status-wrapper group">
                          <div className={`mh-status-icon ${hasExploit ? 'active exploit' : ''}`}>
                            <Target className="w-4 h-4" />
                          </div>
                          {hasExploit && (
                            <div className="mh-tooltip platinum-container-frame">
                              <div className="mh-tooltip-header">🎯 Exploit Signals</div>
                              <div className="mh-tooltip-body">
                                {h.exploit_signals.slice(0, 2).map((sig: any, i: number) => (
                                  <div key={i}>{sig.icon} {sig.name}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Review Icon with Tooltip */}
                        <div className="mh-status-wrapper group">
                          <div className={`mh-status-icon ${hasReview ? 'active review' : ''}`}>
                            <User className="w-4 h-4" />
                          </div>
                          {hasReview && (
                            <div className="mh-tooltip platinum-container-frame">
                              <div className="mh-tooltip-header">👤 Play Review</div>
                              <div className="mh-tooltip-body">{renderMarkdown(h.exploit_deviation?.slice(0, 200) ?? '')}...</div>
                            </div>
                          )}
                        </div>

                        {h.session?.name && <span className="mh-session-badge">📁 {h.session.name}</span>}
                        {!h.session?.name && h.source === 'quick_save' && <span className="mh-quick-badge">⚡</span>}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      {/* Hand Detail Modal */}
      {selectedHand && (
        <div className="mh-modal-overlay" onClick={() => setSelectedHand(null)}>
          <div className="mh-modal platinum-container-frame" onClick={(e) => e.stopPropagation()}>
            <button className="mh-modal-close" onClick={() => setSelectedHand(null)}>
              <X className="w-5 h-5" />
            </button>

            <div className="mh-modal-header">
              <div className="mh-modal-cards">{renderHeroCards(selectedHand.cards, 'large')}</div>
              <div className="mh-modal-meta">
                {selectedHand.position && <span className="mh-position-badge large">{selectedHand.position}</span>}
                <span className="mh-modal-stakes">{selectedHand.stakes || '—'}</span>
                <span className="mh-modal-date">{selectedHand.date || selectedHand.created_at?.slice(0, 10)}</span>
              </div>
            </div>

            {selectedHand.session?.name && (
              <div className="mh-modal-session">📁 Session: {selectedHand.session.name}</div>
            )}

            {/* Board Display */}
            {selectedHand.board && (
              <div className="mh-modal-board">
                <span className="mh-board-label">Board:</span> {selectedHand.board}
              </div>
            )}

            <div className="mh-modal-sections">
              {/* Hand Actions - shows what user played */}
              {selectedHand.hand_actions && (
                <div className="mh-modal-section">
                  <div className="mh-modal-section-title">🎲 Hand Actions</div>
                  <div className="mh-modal-section-body">{renderActionTimeline(selectedHand)}</div>
                </div>
              )}

              {selectedHand.gto_strategy && (
                <div className="mh-modal-section">
                  <div className="mh-modal-section-title">
                    <span className="gto-inline-icon">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                    </span>
                    GTO Strategy
                  </div>
                  <div className="mh-modal-section-body">{selectedHand.gto_strategy}</div>
                </div>
              )}

              {selectedHand.exploit_signals && selectedHand.exploit_signals.length > 0 && (
                <div className="mh-modal-section">
                  <div className="mh-modal-section-title">🎯 Exploit Signals</div>
                  <div className="mh-modal-section-body">
                    {selectedHand.exploit_signals.map((sig: any, i: number) => (
                      <div key={i} className="mh-exploit-item">
                        <span className="mh-exploit-icon">{sig.icon}</span>
                        <span className="mh-exploit-name">{sig.name}</span>
                        {sig.overallAdvice && <div className="mh-exploit-advice">💡 {sig.overallAdvice}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedHand.exploit_deviation && (
                <div className="mh-modal-section">
                  <div className="mh-modal-section-title">👤 Play Review</div>
                  <div className="mh-modal-section-body">{renderMarkdown(selectedHand.exploit_deviation)}</div>
                </div>
              )}

              {!selectedHand.gto_strategy && !selectedHand.exploit_deviation && !selectedHand.hand_actions && (
                <div className="mh-modal-empty">
                  No analysis or actions saved yet.
                </div>
              )}
            </div>

            <div className="mh-modal-actions">
              <Link href={`/hand/${selectedHand.id}`} className="mh-modal-btn btn-platinum-premium">
                View Full Details →
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ============================================
           MY HANDS - PREMIUM REDESIGN V2
           ============================================ */
        
        .mh-page { padding: 24px 20px; min-height: 100vh; background: #1c1c1c !important; }
        .mh-container { max-width: 1200px; margin: 0 auto; }
        
        .mh-header { margin-bottom: 24px; }
        .mh-title { font-size: 36px; font-weight: 800; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px; }
        .mh-subtitle { margin: 0; font-size: 14px; opacity: 0.7; }
        
        /* Filter Bar */
        .mh-filter-bar { display: flex; gap: 10px; margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
        .mh-filter-bar::-webkit-scrollbar { display: none; }
        
        .mh-filter-pill {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 20px;
          border: 1px solid #444; background: #1a1a1a; color: #888; font-size: 13px;
          font-weight: 600; white-space: nowrap; cursor: pointer; transition: all 0.2s ease;
        }
        .mh-filter-pill:hover { border-color: #666; color: #ccc; }
        .mh-filter-pill.active {
          background: linear-gradient(145deg, #333, #222); border-color: #888; color: #fff;
          box-shadow: 0 0 12px rgba(200, 200, 200, 0.15), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        
        /* Stats + Upload Row */
        .mh-stats-upload-row { display: flex; gap: 12px; margin-bottom: 20px; align-items: stretch; }
        
        .mh-stats-bar { display: flex; align-items: center; gap: 20px; padding: 12px 20px; flex: 1; }
        .mh-stat { display: flex; align-items: center; gap: 6px; }
        .mh-stat-value { font-size: 18px; font-weight: 700; color: #fff !important; -webkit-text-fill-color: #fff !important; background: none !important; }
        .mh-stat-label { font-size: 13px; opacity: 0.6; }
        .mh-stat-divider { width: 1px; height: 20px; background: linear-gradient(transparent, #555, transparent); }
        
        .mh-upload-toggle {
          display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 12px;
          border: 1px solid #555; background: #1a1a1a; color: #888; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.2s ease;
        }
        .mh-upload-toggle:hover { border-color: #888; color: #fff; background: #252525; }
        
        /* Upload Section */
        .mh-upload { padding: 16px 20px; margin-bottom: 20px; animation: slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
        .mh-upload-content { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .mh-upload-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .mh-upload-sub { font-size: 13px; opacity: 0.6; }
        .mh-upload-btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 12px; font-size: 14px; cursor: pointer; }
        .mh-upload-msg { margin-top: 12px; font-size: 13px; color: #22c55e !important; -webkit-text-fill-color: #22c55e !important; background: none !important; }
        
        .mh-loading, .mh-empty { text-align: center; padding: 40px 20px; font-size: 14px; opacity: 0.6; }
        .mh-error { text-align: center; padding: 40px 20px; font-size: 14px; color: #ef4444 !important; -webkit-text-fill-color: #ef4444 !important; background: none !important; }
        
        /* Hands Grid */
        .mh-hands-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        
        /* Hand Card - Uses platinum-inner-border class (same as stats bar) */
        .mh-hand-card {
          display: flex; flex-direction: column; padding: 16px; cursor: pointer; transition: all 0.2s ease;
        }
        .mh-hand-card:hover { 
          transform: translateY(-2px); 
        }
        
        .mh-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .mh-hero-cards { display: flex; gap: 6px; }
        
        .hero-card { font-size: 24px; font-weight: 700; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .hero-card.large { font-size: 36px; }
        .hero-card.red { color: #ef4444 !important; -webkit-text-fill-color: #ef4444 !important; background: none !important; }
        .hero-card.black { color: #E2E8F0 !important; -webkit-text-fill-color: #E2E8F0 !important; background: none !important; }
        .hand-card-empty { font-size: 24px; opacity: 0.3; }
        
        .mh-position-badge { padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,0.08) !important; font-size: 12px; font-weight: 700; color: #E2E8F0 !important; -webkit-text-fill-color: #E2E8F0 !important; }
        .mh-position-badge.large { padding: 6px 14px; font-size: 14px; }
        
        .mh-card-meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; opacity: 0.7; }
        .mh-stakes, .mh-date { color: #94a3b8 !important; -webkit-text-fill-color: #94a3b8 !important; background: none !important; }
        
        .mh-card-footer { display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
        
        /* Status Icons with Tooltips */
        .mh-status-wrapper { position: relative; }
        
        .mh-status-icon {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: 6px; background: rgba(255,255,255,0.03); color: #444; transition: all 0.2s ease;
        }
        .mh-status-icon.active { background: rgba(200,200,200,0.1); color: #888; }
        .mh-status-icon.active.exploit { color: #fde047; }
        .mh-status-icon.active.review { color: #a78bfa; }
        .mh-status-icon.active:hover { color: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.2); }
        
        /* Tooltip */
        .mh-tooltip {
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
          width: 280px; padding: 12px; margin-bottom: 8px; z-index: 100;
          opacity: 0; visibility: hidden; transition: all 0.2s ease; pointer-events: none;
        }
        .mh-status-wrapper:hover .mh-tooltip { opacity: 1; visibility: visible; }
        
        .mh-tooltip-header { font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #fff !important; -webkit-text-fill-color: #fff !important; background: none !important; }
        .mh-tooltip-body { font-size: 12px; line-height: 1.5; opacity: 0.8; max-height: 120px; overflow: hidden; }
        
        .mh-session-badge { margin-left: auto; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(100,100,255,0.1) !important; color: #a8a8ff !important; -webkit-text-fill-color: #a8a8ff !important; }
        .mh-quick-badge { margin-left: auto; font-size: 14px; }
        
        /* Modal */
        .mh-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
        }
        
        .mh-modal {
          width: 100%; max-width: 600px; max-height: 80vh; overflow-y: auto; padding: 24px; position: relative;
        }
        
        .mh-modal-close {
          position: absolute; top: 16px; right: 16px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center; border-radius: 8px;
          background: rgba(255,255,255,0.1); border: none; color: #888; cursor: pointer; transition: all 0.2s;
        }
        .mh-modal-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
        
        .mh-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .mh-modal-cards { display: flex; gap: 8px; }
        .mh-modal-meta { display: flex; align-items: center; gap: 12px; }
        .mh-modal-stakes, .mh-modal-date { font-size: 14px; color: #888 !important; -webkit-text-fill-color: #888 !important; background: none !important; }
        
        .mh-modal-session { font-size: 13px; padding: 8px 12px; border-radius: 8px; background: rgba(100,100,255,0.1); margin-bottom: 20px; color: #a8a8ff !important; -webkit-text-fill-color: #a8a8ff !important; }
        
        .mh-modal-sections { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
        
        .mh-modal-section { padding: 16px; border-radius: 10px; background: rgba(0,0,0,0.3); }
        .mh-modal-section-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: #fff !important; -webkit-text-fill-color: #fff !important; background: none !important; }
        .mh-modal-section-body { font-size: 13px; line-height: 1.6; opacity: 0.85; white-space: pre-wrap; }
        
        .mh-exploit-item { margin-bottom: 8px; }
        .mh-exploit-icon { margin-right: 6px; }
        .mh-exploit-name { font-weight: 600; }
        .mh-exploit-advice { margin-top: 4px; padding-left: 24px; font-size: 12px; color: #fde047 !important; -webkit-text-fill-color: #fde047 !important; background: none !important; }
        
        .mh-modal-empty { text-align: center; padding: 30px; font-size: 14px; opacity: 0.6; }
        
        .mh-modal-actions { display: flex; gap: 12px; }
        .mh-modal-btn { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px 20px; border-radius: 12px; font-size: 14px; text-decoration: none; }
        
        @media (max-width: 768px) {
          .mh-page { padding: 16px 12px; }
          .mh-title { font-size: 28px; }
          .mh-hands-grid { grid-template-columns: 1fr; }
          .mh-stats-upload-row { flex-direction: column; }
          .mh-modal { max-height: 90vh; }
        }

        /* Board Display */
        .mh-modal-board { padding: 10px 14px; border-radius: 8px; background: rgba(40,40,50,0.5); margin-bottom: 16px; font-size: 14px; }
        .mh-board-label { color: rgba(255,255,255,0.5); font-weight: 600; margin-right: 8px; }

        /* Web Action Timeline */
        .web-action-timeline { display: flex; flex-direction: column; gap: 10px; }
        .web-action-setup { display: flex; gap: 12px; font-size: 13px; color: rgba(255,255,255,0.6); padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .web-action-street { display: flex; flex-direction: column; gap: 6px; }
        .web-action-street-name { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; }
        .web-action-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .web-action-chip { 
          display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 16px;
          font-size: 12px; font-weight: 600; background: rgba(50,50,60,0.6); color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .web-action-chip.hero { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
        .web-action-chip.villain { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
      `}</style>
    </main>
  );
}
