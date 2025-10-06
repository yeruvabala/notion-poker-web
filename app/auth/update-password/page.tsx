'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg('Password updated. Redirecting to login…');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (e: any) {
      setErr(e?.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pwRoot">
      <form className="card" onSubmit={submit}>
        <h2 className="title">Set a new password</h2>
        <label className="lbl">New password</label>
        <input
          className="input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />
        <button className="cta" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
        {err && <div className="alert err">{err}</div>}
        {msg && <div className="alert ok">{msg}</div>}
      </form>

      <style jsx>{`
        :root{
          --bg:#f5f6f8; --card:#ffffff; --line:#e5e7eb; --text:#0f172a;
          --muted:#6b7280; --indigo:#4f46e5; --indigo-700:#4338ca;
          --ok:#065f46; --ok2:#d1fae5; --err:#991b1b;
        }
        .pwRoot{ min-height:100dvh; display:grid; place-items:center; background:var(--bg); color:var(--text) }
        .card{ width:min(440px, 92vw); background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,.06); padding:24px }
        .title{ margin:0 0 6px 0 }
        .lbl{ font-size:12px; color:var(--muted) }
        .input{ width:100%; border:1px solid var(--line); border-radius:12px; background:#fff; padding:12px 14px; font-size:15px; color:var(--text); margin-top:6px }
        .cta{ width:100%; margin-top:12px; padding:12px 14px; border-radius:12px; background:var(--indigo); color:#fff; font-weight:800; border:1px solid #c7d2fe }
        .cta:hover{ background:var(--indigo-700) }
        .alert{ border-radius:12px; padding:10px 12px; margin-top:8px; font-size:14px }
        .alert.err{ background:var(--err); color:#fff }
        .alert.ok{ background:var(--ok); color:var(--ok2) }
      `}</style>
    </main>
  );
}
