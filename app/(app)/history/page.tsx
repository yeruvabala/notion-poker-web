'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Hand = {
  id: string;
  created_at: string;
  date: string | null;
  stakes: string | null;
  position: string | null;
  cards?: string | null;
};

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hands, setHands] = useState<Hand[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!supabase) {
          setError('Missing Supabase env vars. See /api/env-ok.');
          setLoading(false);
          return;
        }

        // Ensure the user is signed in
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          router.replace('/login');
          return;
        }

        // Fetch current user's hands (RLS will also restrict to their rows)
        const { data, error } = await supabase
          .from('hands')
          .select('id, created_at, date, stakes, position, cards')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        if (!cancelled) setHands(data ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  return (
    <main className="p">
      <div className="wrap">
        <h1 className="title">My Hands</h1>

        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <Link href="/" className="btn">← Back to App</Link>
        </div>

        {loading && <div className="ibox">Loading…</div>}
        {error && <div className="err">{error}</div>}

        {!loading && !error && hands.length === 0 && (
          <div className="ibox">No hands yet — analyze a hand and click “Confirm &amp; Save”.</div>
        )}

        {!loading && !error && hands.length > 0 && (
          <ul className="list">
            {hands.map((h) => (
              <li key={h.id} className="row item">
                <div className="left">
                  <div className="big">{h.date || new Date(h.created_at).toISOString().slice(0, 10)}</div>
                  <div className="muted small">{new Date(h.created_at).toLocaleString()}</div>
                </div>
                <div className="mid">
                  <div><b>Stakes:</b> {h.stakes || '—'}</div>
                  <div><b>Pos:</b> {h.position || '—'}</div>
                </div>
                <div className="right">
                  <div><b>Cards:</b> {h.cards || '—'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx global>{`
        :root{
          --bg:#f3f4f6; --card:#ffffff; --line:#e5e7eb; --text:#0f172a; --muted:#6b7280;
          --primary:#2563eb; --primary2:#1d4ed8; --btnText:#f8fbff;
        }
        .p{padding:24px}
        .wrap{max-width:920px;margin:0 auto}
        .title{margin:0 0 12px;font-size:28px;font-weight:800;text-align:center}
        .row{display:flex;align-items:center}
        .btn{border:1px solid var(--line);background:#fff;padding:10px 14px;border-radius:12px;cursor:pointer;text-decoration:none;color:inherit}
        .ibox{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
        .err{background:#fee2e2;border:1px solid #fecaca;border-radius:14px;padding:12px;color:#991b1b}
        .list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
        .item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;justify-content:space-between}
        .left{min-width:180px}
        .mid{min-width:200px}
        .big{font-weight:700}
        .muted{color:var(--muted)}
        .small{font-size:12px}
      `}</style>
    </main>
  );
}
