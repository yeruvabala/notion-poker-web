// app/(app)/history/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

      const { data, error } = await supabase
        .from('hands')
        .select(
          `
          id,
          created_at,
          date,
          stakes,
          position,
          cards,
          gto_strategy,
          exploit_deviation
        `
        )
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

      if (uerr) throw new Error(`Supabase getUser error: ${uerr.message}`);
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
          `Upload failed with status ${upRes.status}`;
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
                  <span>Coach status</span>
                </div>
                <div className="history-divider" />
                <ul className="history-table-body">
                  {hands.map((h) => {
                    const d = h.date || h.created_at?.slice(0, 10);
                    const coached = h.gto_strategy ? 'Coached' : 'Pending';
                    return (
                      <li key={h.id}>
                        <Link href={`/hand/${h.id}`} className="history-row" style={{ textDecoration: 'none' }}>
                          <span>{d || '—'}</span>
                          <span>{h.stakes || '—'}</span>
                          <span>{h.position || '—'}</span>
                          <span>{renderCards(h.cards)}</span>
                          <span
                            className={
                              h.gto_strategy ? 'history-pill-ok' : 'history-pill-pending'
                            }
                          >
                            {coached}
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
          grid-template-columns: 120px 120px 120px 1fr 120px;
          font-size: 13px;
          font-weight: 700;
          color: #E2E8F0 !important;
          background: rgba(0, 0, 0, 0.3);
          padding: 10px 8px;
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
          grid-template-columns: 120px 120px 120px 1fr 120px;
          font-size: 13px;
          padding: 10px 8px;
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
        
        /* Status Pills - Metallic gradient borders */
        .history-pill-ok,
        .history-pill-pending {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 2px solid transparent;
        }
        
        /* Coached - Metallic Green gradient border */
        .history-pill-ok {
          background: 
            linear-gradient(#1c1c1c, #1c1c1c) padding-box,
            linear-gradient(135deg, 
              #155e35 0%, 
              #22c55e 25%, 
              #4ade80 50%, 
              #22c55e 75%, 
              #155e35 100%
            ) border-box !important;
          -webkit-background-clip: padding-box, border-box !important;
          background-clip: padding-box, border-box !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }
        .history-pill-ok span,
        .history-pill-ok {
          background: 
            linear-gradient(#1c1c1c, #1c1c1c) padding-box,
            linear-gradient(135deg, #155e35 0%, #22c55e 25%, #4ade80 50%, #22c55e 75%, #155e35 100%) border-box;
        }
        /* Text gradient for Coached */
        .history-pill-ok::after {
          content: '';
        }
        .history-row .history-pill-ok {
          background: 
            linear-gradient(#1c1c1c, #1c1c1c) padding-box,
            linear-gradient(135deg, #155e35 0%, #22c55e 25%, #4ade80 50%, #22c55e 75%, #155e35 100%) border-box !important;
          color: #22c55e !important;
          -webkit-text-fill-color: #22c55e !important;
        }
        
        /* Pending - Metallic Blue gradient border */
        .history-pill-pending {
          background: 
            linear-gradient(#1c1c1c, #1c1c1c) padding-box,
            linear-gradient(135deg, 
              #1e40af 0%, 
              #3b82f6 25%, 
              #60a5fa 50%, 
              #3b82f6 75%, 
              #1e40af 100%
            ) border-box !important;
          -webkit-background-clip: padding-box, border-box !important;
          background-clip: padding-box, border-box !important;
        }
        .history-row .history-pill-pending {
          background: 
            linear-gradient(#1c1c1c, #1c1c1c) padding-box,
            linear-gradient(135deg, #1e40af 0%, #3b82f6 25%, #60a5fa 50%, #3b82f6 75%, #1e40af 100%) border-box !important;
          color: #3b82f6 !important;
          -webkit-text-fill-color: #3b82f6 !important;
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
            grid-template-columns: 90px 90px 80px 1fr 90px;
            font-size: 12px;
          }
        }
      `}</style>
    </main>
  );
}

