
// app/(app)/history/page.tsx
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot, User, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EnhancedGTOTooltip } from './components/EnhancedGTOTooltip';
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";

type Hand = {
  id: string;
  created_at: string;
  date: string | null;
  stakes: string | null;
  position: string | null;
  cards: string | null;
  gto_strategy: string | null;
  exploit_deviation: string | null;
  exploit_signals: any;
  // Phase 12-14.5: Enhanced coaching data
  hero_classification?: any;
  spr_analysis?: any;
  mistake_analysis?: any;
};

// Helper to render cards with proper suit colors
function renderCards(cards: string | null) {
  if (!cards) return '—';
  return cards.split(' ').map((card, i) => {
    const suit = card.slice(-1);
    const isRed = suit === '♥' || suit === '♦';
    return (
      <span key={i} style={{
        color: isRed ? '#ef4444' : '#E2E8F0',
        marginRight: 4,
        fontWeight: 600
      }}>
        {card}
      </span>
    );
  });
}

// Helper to render simple markdown (bolding)
function renderMarkdown(text: string | null) {
  if (!text) return '—';

  // Split by ** delimiters
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove asterisks and render bold
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hands, setHands] = useState<Hand[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        console.error(userErr);
        if (!cancelled) {
          setErr('Could not load user session.');
          setLoading(false);
        }
        return;
      }

      if (!user) {
        if (!cancelled) {
          router.push('/');
        }
        return;
      }

      // Fetch hands with backward compatibility
      // Phase 12-14.5 columns are optional (might not exist yet)
      const { data, error } = await supabase
        .from('hands')
        .select('*')  // Select all columns (handles missing columns gracefully)
        .eq('user_id', user.id)
        .order('date', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) {
        console.error(error);
        if (!cancelled) {
          setErr('Failed to load hands.');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setHands((data || []) as Hand[]);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  // --- NEW: upload that both uploads to S3 and enqueues in hand_files ----
  async function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(null);
    setUploadBusy(true);

    try {
      // 1) ensure user is logged in
      const {
        data: { user },
        error: uerr,
      } = await supabase.auth.getUser();

      if (uerr) throw new Error(`Supabase getUser error: ${uerr.message} `);
      if (!user) throw new Error('Please sign in.');

      // 2) Direct upload to our API (server will put to S3)
      const fd = new FormData();
      fd.append('file', file);

      const upRes = await fetch('/api/uploads/direct', {
        method: 'POST',
        body: fd,
      });

      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        const msg =
          upJson?.error ||
          upJson?.message ||
          `Upload failed with status ${upRes.status} `;
        throw new Error(msg);
      }

      const { key, contentType } = upJson as {
        key: string;
        contentType: string;
      };

      // 3) Enqueue into hand_files so worker.py can claim it
      const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET;
      if (!bucket) {
        throw new Error(
          'NEXT_PUBLIC_AWS_S3_BUCKET is not set in the frontend env.'
        );
      }

      const s3Path = `s3://${bucket}/${key}`;

      const enqueueRes = await fetch('/api/hand-files/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: s3Path,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: contentType || file.type || 'text/plain',
        }),
      });

      const enqueueJson = await enqueueRes.json().catch(() => ({}));
      if (!enqueueRes.ok || !enqueueJson?.ok) {
        const msg =
          enqueueJson?.error ||
          enqueueJson?.message ||
          `Enqueue failed with status ${enqueueRes.status}`;
        throw new Error(msg);
      }

      setUploadMsg(
        'Uploaded & queued ✓  The robot will parse it and new hands will show up here soon.'
      );

      // allow selecting the same file again
      e.target.value = '';
    } catch (error: any) {
      console.error('upload error', error);
      setUploadMsg(`Error: ${error?.message || 'Upload failed'}`);
    } finally {
      setUploadBusy(false);
    }
  }

  const hasHands = hands.length > 0;

  return (
    <main className="op-surface history-page">
      <div className="history-wrap">
        <header className="history-header">
          <div>
            <h1 className="history-title platinum-text-gradient">My Hands</h1>
            <p className="history-sub">
              Recent hands you&apos;ve sent to Only Poker. New uploads will
              appear here after the background parser finishes.
            </p>
          </div>
        </header>

        {/* Upload block */}
        <section className="history-card history-upload platinum-container-frame">
          <div className="history-upload-main">
            <div>
              <div className="history-upload-title">Upload hand history (.txt)</div>
              <div className="history-upload-sub">
                Choose a hand history file from your poker site. We&apos;ll
                store it in S3 and queue it for parsing.
              </div>
            </div>
            <div>
              <label className="history-file-btn btn-platinum-premium">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleUploadChange}
                  disabled={uploadBusy}
                  style={{ display: 'none' }}
                />
                {uploadBusy ? 'Uploading…' : 'Choose File'}
              </label>
            </div>
          </div>
          {uploadMsg && <div className="history-upload-msg">{uploadMsg}</div>}
        </section>

        {loading && <div className="history-muted">Loading hands…</div>}
        {err && !loading && <div className="history-error">{err}</div>}

        {!loading && !err && (
          <>
            {!hasHands && (
              <div className="history-muted">
                No hands found yet. Upload a .txt history file to get started.
              </div>
            )}

            {hasHands && (
              <section className="history-card platinum-container-frame">
                <div className="history-table-header">
                  <span>Date</span>
                  <span>Stakes</span>
                  <span>Position</span>
                  <span>Cards</span>
                  <span className="flex items-center justify-center gap-1">
                    <Bot className="w-4 h-4 text-[#737373]" />
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <Target className="w-4 h-4 text-[#737373]" />
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <User className="w-4 h-4 text-[#737373]" />
                  </span>
                </div>
                <div className="history-divider" />
                <ul className="history-table-body">
                  {hands.map((h) => {
                    const d = h.date || h.created_at?.slice(0, 10);
                    const gto = h.gto_strategy;
                    const exploit = h.exploit_deviation;

                    return (
                      <li key={h.id}>
                        <Link href={`/hand/${h.id}`} className="history-row" style={{ textDecoration: 'none' }}>
                          <span>{d || '—'}</span>
                          <span>{h.stakes || '—'}</span>
                          <span>{h.position || '—'}</span>
                          <span>{renderCards(h.cards)}</span>

                          {/* GTO / Robot Column */}
                          <span className="flex items-center justify-center">
                            {gto ? (
                              <EnhancedGTOTooltip
                                gtoStrategy={gto}
                                heroClassification={h.hero_classification}
                                spr={h.spr_analysis}
                                mistakes={h.mistake_analysis}
                              />
                            ) : (
                              <Bot className="w-5 h-5 text-[#333] opacity-30" />
                            )}
                          </span>

                          {/* Exploit Signals Column - NEW! */}
                          <span className="flex items-center justify-center">
                            {h.exploit_signals && h.exploit_signals.length > 0 ? (
                              <div className="group relative">
                                <Target
                                  className="w-5 h-5 text-[#737373] transition-all duration-300 hover:text-[#fde047] hover:drop-shadow-[0_0_8px_rgba(253,224,71,0.5)] cursor-help"
                                />
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 w-80 p-5 platinum-container-frame shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
                                  <div className="mb-3 border-b border-[#444] pb-2">
                                    <span className="font-bold uppercase tracking-wider text-[11px] platinum-text-gradient">🎯 Exploit Signals</span>
                                  </div>
                                  <div className="flex gap-2 mb-3">
                                    {h.exploit_signals.map((arch: any) => (
                                      <span key={arch.id} className="text-lg" title={arch.name}>{arch.icon}</span>
                                    ))}
                                  </div>
                                  {h.exploit_signals.map((arch: any) => (
                                    <div key={arch.id} className="mb-3 text-xs">
                                      <div className="font-bold text-[#e2e8f0] mb-1">{arch.icon} vs {arch.name}</div>
                                      {arch.streets?.slice(0, 2).map((st: any, i: number) => (
                                        <div key={i} className="text-[#94a3b8]">
                                          <strong>{st.street}:</strong> {st.adjustedAction} {st.adjustedFreq}%
                                          <span className={st.direction === 'increase' ? ' text-green-400' : st.direction === 'decrease' ? ' text-red-400' : ''}>
                                            {st.direction === 'increase' ? ' ↑' : st.direction === 'decrease' ? ' ↓' : ' →'}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="text-[#fde047] mt-1">💡 {arch.overallAdvice}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <Target className="w-5 h-5 text-[#333] opacity-30" />
                            )}
                          </span>

                          {/* Exploit / Human Column */}
                          <span className="flex items-center justify-center">
                            {exploit ? (
                              <div className="group relative">
                                <User
                                  className="w-5 h-5 text-[#737373] transition-all duration-300 hover:text-[#e2e8f0] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] cursor-help"
                                />
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 w-96 p-5 platinum-container-frame shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
                                  <div className="mb-3 border-b border-[#444] pb-2">
                                    <span className="font-bold uppercase tracking-wider text-[11px] platinum-text-gradient">Play Review</span>
                                  </div>
                                  <div className="text-xs leading-relaxed whitespace-pre-wrap platinum-text-gradient font-medium">
                                    {renderMarkdown(exploit)}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <User className="w-5 h-5 text-[#333] opacity-30" />
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        /* Dark Mode Platinum Theme for History Page */
        .history-page {
          padding: 28px 18px;
          min-height: 100vh;
          background: #1c1c1c !important;
        }
        .history-wrap {
          max-width: 1100px;
          margin: 0 auto;
        }
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
        }
        
        /* Title - Metallic Gradient */
        .history-title {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        /* Subtitle - Metallic gradient text */
        .history-sub {
          margin: 0;
          font-size: 14px;
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 40%, #94A3B8 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        
        /* Back Button - Using btn-platinum-premium */
        .history-back {
          font-size: 14px;
          border-radius: 12px;
          padding: 10px 20px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        
        /* Cards - Dark grey container with platinum border */
        .history-card {
          padding: 18px 20px;
          margin-bottom: 20px;
        }
        
        /* Upload Section */
        .history-upload {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .history-upload-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .history-upload-title {
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 6px;
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        .history-upload-sub {
          font-size: 13px;
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 40%, #94A3B8 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        
        /* File Upload Button - Using btn-platinum-premium */
        .history-file-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 14px;
          cursor: pointer;
          color: #1a1a1a !important;
          -webkit-text-fill-color: #1a1a1a !important;
        }
        
        .history-upload-msg {
          font-size: 13px;
          color: #22c55e !important;
          background: none !important;
          -webkit-text-fill-color: #22c55e !important;
          margin-top: 4px;
        }
        
        /* Muted & Error text */
        .history-muted {
          font-size: 14px;
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 40%, #94A3B8 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          margin-top: 12px;
        }
        .history-error {
          font-size: 14px;
          color: #ef4444 !important;
          background: none !important;
          -webkit-text-fill-color: #ef4444 !important;
          margin-top: 12px;
        }
        
        /* Table Header - Darker background with bright platinum */
        .history-table-header {
          display: grid;
          grid-template-columns: 1.5fr 1.2fr 1fr 2fr 60px 60px 60px;
          font-size: 13px;
          font-weight: 700;
          color: #E2E8F0 !important;
          background: rgba(0, 0, 0, 0.3);
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 8px;
          -webkit-text-fill-color: transparent !important;
        }
        .history-table-header span {
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        
        /* Divider - Platinum */
        .history-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #E2E8F0 20%, #E2E8F0 80%, transparent);
          margin-bottom: 8px;
          opacity: 0.3;
        }
        
        /* Table Body */
        .history-table-body {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        /* Table Rows - Dark transparent with platinum dividers */
        .history-row {
          display: grid;
          grid-template-columns: 1.5fr 1.2fr 1fr 2fr 60px 60px 60px;
          font-size: 13px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.15);
          color: #E2E8F0 !important;
          background: transparent;
          align-items: center;
        }
        .history-row span {
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        .history-row:last-child {
          border-bottom: none;
        }
        .history-row:hover {
          background: rgba(226, 232, 240, 0.05);
          cursor: pointer;
        }
        
        @media (max-width: 768px) {
          .history-page {
            padding: 18px 12px;
          }
          .history-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .history-table-header,
          .history-row {
            grid-template-columns: 90px 90px 70px 1fr 50px 50px 50px;
            font-size: 12px;
          }
        }
      `}</style>
    </main>
  );
}

