// app/history/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export default async function HistoryPage() {
  const sb = createServerClient();
  if (!sb) {
    return (
      <main className="p">
        <div className="wrap">Missing Supabase env vars. See <code>/api/env-ok</code>.</div>
      </main>
    );
  }

  // Require auth
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  // Thanks to RLS, this returns only this user’s rows
  const { data, error } = await sb
    .from('hands')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="p">
        <div className="wrap">Error loading hands: {error.message}</div>
      </main>
    );
  }

  return (
    <main className="p">
      <div className="wrap">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <h1 className="title" style={{margin:0}}>My Hands</h1>
          <div style={{display:'flex', gap:8}}>
            <Link href="/" className="btn">+ New</Link>
          </div>
        </div>

        <section className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Stakes</th>
                <th>Pos</th>
                <th>Cards</th>
                <th>Board</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              {data && data.length > 0 ? (
                data.map((h: any) => (
                  <tr key={h.id}>
                    <td>{h.date ?? ''}</td>
                    <td>{h.stakes ?? ''}</td>
                    <td>{h.position ?? ''}</td>
                    <td>{h.cards ?? ''}</td>
                    <td>{h.board ?? ''}</td>
                    <td>{h.hand_class ?? ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ color: '#6b7280' }}>
                    No hands yet — save one from the home page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Tiny table styles to match your app */}
      <style jsx global>{`
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th, .tbl td { border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; }
        .tbl th { background: #f8fafc; text-align: left; }
      `}</style>
    </main>
  );
}
