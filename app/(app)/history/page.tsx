'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

  async function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(null);
    setUploadBusy(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/direct', {
        method: 'POST',
        body: formData,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          `Upload failed with status ${res.status}`;
        throw new Error(msg);
      }

      setUploadMsg(
        "Upload received. We'll parse these hands in the background over the next few minutes."
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
    <main className="op-page">
      <div className="op-wrap">
        <header className="op-header">
          <div>
            <h1 className="op-title">My Hands</h1>
            <p className="op-sub">
              Recent hands you&apos;ve sent to Only Poker. New uploads will appear
              here after the background parser finishes.
            </p>
          </div>
          <Link href="/" className="op-back">
            ← Back to App
          </Link>
        </header>

        {/* Upload block moved here from Study tab */}
        <section className="op-card op-upload">
          <div className="op-upload-main">
            <div>
              <div className="op-upload-title">Upload hand history (.txt)</div>
              <div className="op-upload-sub">
                Choose a hand history file from your poker site. We&apos;ll store it
                in S3 and queue it for parsing.
              </div>
            </div>
            <div>
              <input
                type="file"
                accept=".txt"
                onChange={handleUploadChange}
                disabled={uploadBusy}
              />
            </div>
          </div>
          {uploadMsg && <div className="op-upload-msg">{uploadMsg}</div>}
        </section>

        {loading && <div className="op-muted">Loading hands…</div>}
        {err && !loading && <div className="op-error">{err}</div>}

        {!loading && !err && (
          <>
            {!hasHands && (
              <div className="op-muted">
                No hands found yet. Upload a .txt history file to get started.
              </div>
            )}

            {hasHands && (
              <section className="op-card">
                <div className="op-table-header">
                  <span>Date</span>
                  <span>Stakes</span>
                  <span>Position</span>
                  <span>Cards</span>
                  <span>Coach status</span>
                </div>
                <div className="op-divider" />
                <ul className="op-table-body">
                  {hands.map((h) => {
                    const d = h.date || h.created_at?.slice(0, 10);
                    const coached = h.gto_strategy ? 'Coached' : 'Pending';
                    return (
                      <li key={h.id} className="op-row">
                        <span>{d || '—'}</span>
                        <span>{h.stakes || '—'}</span>
                        <span>{h.position || '—'}</span>
                        <span>{h.cards || '—'}</span>
                        <span
                          className={
                            h.gto_strategy ? 'op-pill-ok' : 'op-pill-pending'
                          }
                        >
                          {coached}
                        </span>
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
        .op-page {
          padding: 28px 18px;
        }
        .op-wrap {
          max-width: 1100px;
          margin: 0 auto;
        }
        .op-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .op-title {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 4px;
        }
        .op-sub {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }
        .op-back {
          font-size: 14px;
          border-radius: 999px;
          padding: 6px 14px;
          border: 1px solid #e5e7eb;
          text-decoration: none;
        }
        .op-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          padding: 16px 18px;
          margin-bottom: 16px;
        }
        .op-upload {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .op-upload-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .op-upload-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .op-upload-sub {
          font-size: 13px;
          color: #6b7280;
        }
        .op-upload-msg {
          font-size: 12px;
          color: #4b5563;
        }
        .op-muted {
          font-size: 14px;
          color: #6b7280;
          margin-top: 8px;
        }
        .op-error {
          font-size: 14px;
          color: #b91c1c;
          margin-top: 8px;
        }
        .op-table-header {
          display: grid;
          grid-template-columns: 120px 120px 120px 1fr 120px;
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 6px;
        }
        .op-divider {
          height: 1px;
          background: #e5e7eb;
          margin-bottom: 4px;
        }
        .op-table-body {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .op-row {
          display: grid;
          grid-template-columns: 120px 120px 120px 1fr 120px;
          font-size: 13px;
          padding: 6px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .op-row:last-child {
          border-bottom: none;
        }
        .op-pill-ok,
        .op-pill-pending {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 12px;
        }
        .op-pill-ok {
          background: #ecfdf3;
          color: #15803d;
        }
        .op-pill-pending {
          background: #eff6ff;
          color: #1d4ed8;
        }

        @media (max-width: 768px) {
          .op-page {
            padding: 18px 12px;
          }
          .op-table-header,
          .op-row {
            grid-template-columns: 90px 90px 80px 1fr 90px;
          }
        }
      `}</style>
    </main>
  );
}
