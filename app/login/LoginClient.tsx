'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function LoginClient() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const search = useSearchParams();

  // ui state
  const initialTab = (search?.get('mode') === 'signup') ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/'); // go home
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmations are enabled, user must check inbox
        if (data?.user && !data.user.email_confirmed_at) {
          setMsg('Account created. Check your email to confirm before signing in.');
        } else {
          router.replace('/');
          router.refresh();
        }
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p">
      <div className="wrap">
        <div className="panel">
          {/* Left brand side – optional graphic area */}
          <div className="brand">
            <div className="logo">Only Poker</div>
          </div>

          {/* Right auth form */}
          <div className="auth">
            <div className="tabs">
              <button
                className={`tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => setMode('signin')}
              >
                Log in
              </button>
              <button
                className={`tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
              >
                Create account
              </button>
            </div>

            <form onSubmit={onSubmit} className="form">
              <label className="lbl">Email</label>
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <label className="lbl">Password</label>
              <input
                className="input"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <button className="cta altBlack" type="submit" disabled={busy}>
                {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
              </button>

              {err && <div className="err">{err}</div>}
              {msg && <div className="note">{msg}</div>}
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        :root{
          --bg:#f5f6f8;         /* match app */
          --card:#ffffff;
          --line:#e5e7eb;
          --text:#0f172a;
          --muted:#6b7280;
          --black:#111111;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}
        .wrap{width:100%;max-width:980px}
        .panel{
          background:var(--card);
          border:1px solid var(--line);
          border-radius:16px;
          overflow:hidden;
          display:grid;
          grid-template-columns:1fr 1fr;
          box-shadow:0 12px 40px rgba(0,0,0,.06);
        }
        @media (max-width:900px){ .panel{grid-template-columns:1fr} }

        .brand{
          background:linear-gradient(180deg,#fafafa,#f0f1f5);
          border-right:1px solid var(--line);
          padding:32px;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        @media (max-width:900px){ .brand{display:none} }

        .logo{
          font-size:32px;
          font-weight:800;
          letter-spacing:.2px;
        }

        .auth{ padding:28px 28px 36px 28px; }

        .tabs{
          display:flex;
          gap:20px;
          border-bottom:1px solid var(--line);
          margin-bottom:20px;
        }
        .tab{
          appearance:none; background:none; border:none;
          padding:14px 6px; margin:0; cursor:pointer;
          font-weight:700; font-size:15px; color:var(--black);
          border-bottom:2px solid transparent;
        }
        .tab.active{
          border-bottom-color:var(--black);
        }

        .form{ display:flex; flex-direction:column; gap:10px; }
        .lbl{ font-size:12px; color:var(--muted); }
        .input{
          width:100%; padding:12px 14px;
          border:1px solid var(--line); border-radius:12px;
          background:#fff; font-size:15px;
        }
        .input:focus{ outline:2px solid #cbd5e1; }

        /* Base CTA (kept for reuse if you want indigo variant elsewhere) */
        .cta{
          margin-top:8px;
          width:100%; padding:12px 14px; font-weight:700; border-radius:12px;
          border:1px solid var(--line); background:#fff; color:var(--text); cursor:pointer;
          transition:background .15s,color .15s,border-color .15s,opacity .15s;
        }
        .cta[disabled]{ opacity:.6; cursor:not-allowed; }

        /* Black text button variant (requested) */
        .cta.altBlack{
          background:#fff;
          color:var(--black);
          border:1px solid var(--black);
        }
        .cta.altBlack:hover{
          background:var(--black);
          color:#fff;
          border-color:var(--black);
        }

        .err{ margin-top:10px; color:#b91c1c; font-size:14px; }
        .note{ margin-top:10px; color:#166534; font-size:14px; }
      `}</style>
    </main>
  );
}
