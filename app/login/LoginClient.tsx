'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function LoginClient() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function doSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMsg('Check your email to confirm your account.');
    } catch (e: any) {
      setErr(e?.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (!email) throw new Error('Enter your email first.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setMsg('Password reset link sent. Check your email.');
    } catch (e: any) {
      setErr(e?.message || 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authRoot">
      {/* Left brand (light theme) */}
      <section className="brand">
        <div className="brandInner">
          <div className="brandMark">Only Poker</div>
          <div className="brandSub">v0.1 · preview</div>
        </div>
      </section>

      {/* Right panel */}
      <section className="panel">
        <div className="card">
          <div className="tabs">
            <button
              className={`tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
              type="button"
            >
              Log in
            </button>
            <button
              className={`tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => setTab('signup')}
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="form" onSubmit={tab === 'login' ? doLogin : doSignup}>
            <label className="lbl">Email</label>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="lbl">Password</label>
            <input
              className="input"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {tab === 'login' && (
              <div className="row end">
                <button
                  className="link"
                  type="button"
                  onClick={doReset}
                  disabled={busy}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button className="cta" type="submit" disabled={busy}>
              {busy ? (tab === 'login' ? 'Signing in…' : 'Creating…') : (tab === 'login' ? 'Sign in' : 'Create account')}
            </button>

            {err && <div className="alert err">{err}</div>}
            {msg && <div className="alert ok">{msg}</div>}
          </form>
        </div>
      </section>

      <style jsx>{`
        /* ===== Light theme tokens to match the app ===== */
        :root{
          --bg:#f5f6f8;          /* page background */
          --card:#ffffff;        /* cards */
          --line:#e5e7eb;        /* borders */
          --text:#0f172a;        /* main text */
          --muted:#6b7280;       /* muted text */
          --indigo:#4f46e5;      /* primary */
          --indigo-700:#4338ca;  /* primary hover */
          --ok:#065f46;          /* success bg */
          --ok2:#d1fae5;         /* success text */
          --err:#991b1b;         /* error bg */
          --err2:#fee2e2;        /* error text */
        }

        .authRoot{
          min-height:100dvh;
          display:grid;
          grid-template-columns: 1fr 1fr;
          background:var(--bg);
          color:var(--text);
        }
        @media(max-width:980px){ .authRoot{ grid-template-columns:1fr; } }

        .brand{
          display:flex;align-items:center;justify-content:center;
          padding:32px;
          background:
            radial-gradient(1200px 600px at -10% 100%, #f9fafb 0, var(--bg) 60%);
          border-right:1px solid var(--line);
        }
        @media(max-width:980px){ .brand{ display:none; } }

        .brandInner{ text-align:center }
        .brandMark{ font-size:40px; font-weight:900; letter-spacing:.5px; }
        .brandSub{ margin-top:6px; font-size:12px; color:var(--muted) }

        .panel{ display:flex; align-items:center; justify-content:center; padding:24px }
        .card{
          width:min(480px, 92vw);
          background:var(--card);
          border:1px solid var(--line);
          border-radius:16px;
          box-shadow:0 8px 24px rgba(0,0,0,.06);
          padding:20px;
        }
        .tabs{ display:flex; gap:20px; border-bottom:1px solid var(--line); padding-bottom:6px; }
        .tab{
          background:transparent; border:none; cursor:pointer; padding:8px 0;
          color:var(--muted); font-weight:700;
          border-bottom:2px solid transparent;
        }
        .tab.active{ color:var(--text); border-bottom-color:var(--indigo); }

        .form{ padding-top:14px; display:flex; flex-direction:column; gap:10px }
        .lbl{ font-size:12px; color:var(--muted) }
        .input{
          width:100%; border:1px solid var(--line); border-radius:12px;
          background:#fff; padding:12px 14px; font-size:15px; color:var(--text);
        }
        .row.end{ display:flex; justify-content:flex-end; }
        .link{
          background:none; border:none; color:var(--indigo); cursor:pointer; padding:0; font-weight:600;
        }
        .cta{
          width:100%; margin-top:6px; padding:12px 14px; border-radius:12px;
          background:var(--indigo); color:#fff; font-weight:800; border:1px solid #c7d2fe;
          cursor:pointer;
        }
        .cta:hover{ background:var(--indigo-700); }
        .cta[disabled]{ opacity:.6; cursor:not-allowed; }

        .alert{ border-radius:12px; padding:10px 12px; margin-top:6px; font-size:14px }
        .alert.err{ background:var(--err); color:#fff }
        .alert.ok{ background:var(--ok); color:var(--ok2) }
      `}</style>
    </main>
  );
}
