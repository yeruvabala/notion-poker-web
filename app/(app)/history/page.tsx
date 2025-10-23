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
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
};

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hands, setHands] = useState<Hand[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        // Ensure we have a user
        const { data: userResp, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userResp?.user;
        if (!user) {
          router.replace('/login');
          return;
        }

        // Fetch hands including GTO + Deviation
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
          .order('created_at', { ascending: false }); // fallback ordering

        if (error) throw error;
        if (cancelled) return;
        setHands((data as Hand[]) ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load hands');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
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

        {loading && (
          <div className="ibox">Loading…</div>
        )}

        {err && (
          <div className="err">{err}</div>
        )}

        {!loading && !err && hands.length === 0 && (
          <div className="ibox">No hands yet.</div>
        )}

        {!loading && !err && hands.length > 0 && (
          <ul className="list">
            {hands.map((h) => {
              const d = h.date ? new Date(h.date) : h.created_at ? new Date(h.created_at) : null;
              const dateISO = d ? d.toISOString().slice(0, 10) : '—';
              const dateLocal = d ? d.toLocaleString() : '—';

              return (
                <li key={h.id} className="item">
                  {/* Left block — date */}
                  <div className="left">
                    <div className="big">{dateISO}</div>
                    <div className="small muted">{dateLocal}</div>
                  </div>

                  {/* Mid block — meta + NEW: GTO + Deviation */}
                  <div className="mid">
                    <div className="big">
                      <span>Stakes: {h.stakes ?? '—'}</span>
                    </div>
                    <div className="big" style={{ marginTop: 2 }}>
                      <span>Pos: {h.position ?? '—'}</span>
                    </div>

                    {/* NEW: GTO Strategy */}
                    <div className="small" style={{ marginTop: 8 }}>
                      <span className="muted" style={{ fontWeight: 700 }}>GTO: </span>
                      <span className="clamp2">{(h.gto_strategy ?? '').trim() || '—'}</span>
                    </div>
                    {/* NEW: Exploit Deviation */}
                    <div className="small" style={{ marginTop: 6 }}>
                      <span className="muted" style={{ fontWeight: 700 }}>Deviation: </span>
                      <span className="clamp2">{(h.exploit_deviation ?? '').trim() || '—'}</span>
                    </div>
                  </div>

                  {/* Right block — cards */}
                  <div className="big">
                    Cards: {h.cards ?? '—'}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* keep your existing look & feel */}
      <style jsx global>{`
        :root{
          --ink:#0f172a;
          --muted:#6b7280;
          --card:#ffffff;
          --line:#e5e7eb;
        }
        .p{padding:28px 18px}
        .wrap{max-width:1100px;margin:0 auto}
        .title{font-size:44px;font-weight:800;margin:0 0 18px}
        .row{display:flex;align-items:center}
        .btn{border:1px solid var(--line);background:#fff;padding:8px 12px;border-radius:12px;cursor:pointer;text-decoration:none;color:inherit}
        .ibox{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
        .err{background:#fee2e2;border:1px solid #fecaca;border-radius:14px;padding:12px;color:#991b1b}
        .list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
        .item{background:var(--card);border:1px solid var(--line);display:flex;gap:16px;align-items:flex-start;border-radius:14px;padding:12px;justify-content:space-between}
        .left{min-width:180px}
        .mid{min-width:200px;flex:1}
        .big{font-weight:700}
        .muted{color:var(--muted)}
        .small{font-size:12px}
        .clamp2{
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          word-break:break-word;
        }
        @media (max-width:780px){
          .item{flex-direction:column}
          .left,.mid{min-width:auto}
        }
      `}</style>
    </main>
  );
}
