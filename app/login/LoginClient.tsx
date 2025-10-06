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
      router.replace('/');               // go to app after login
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
    <main className="loginWrap">
      {/* Left brand panel */}
      <section className="brand">
        <div className="brandLogo">
          <div className="chip">ONLY</div>
          <div className="title">POKER</div>
        </div>
        <div className="brandTag">Elite Poker Training</div>
      </section>

      {/* Right auth panel */}
      <section className="panel">
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
          <div className="inputRow">
            <span className="icon">✉️</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <label className="lbl">Password</label>
          <div className="inputRow">
            <span className="icon">🔒</span>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {tab === 'login' && (
            <div className="row between">
              <button
                className="link"
                type="button"
                onClick={doReset}
                disabled={busy}
                title="Sends a password reset email"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button className="cta" type="submit" disabled={busy}>
            {busy ? (tab === 'login' ? 'Signing in…' : 'Creating…') : (tab === 'login' ? 'LOGIN' : 'CREATE ACCOUNT')}
          </button>

          {err && <div className="alert err">{err}</div>}
          {msg && <div className="alert ok">{msg}</div>}
        </form>
      </section>

      {/* styles */}
      <style jsx>{`
        .loginWrap{
          min-height:100dvh; display:grid; grid-template-columns:1.2fr 1fr;
          background:#0b0e14; color:#e5e7eb;
        }
        @media(max-width:980px){ .loginWrap{ grid-template-columns:1fr; } .brand{ display:none; } }

        .brand{
          position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:radial-gradient(1200px 600px at -20% 100%, #111827 0, #0b0e14 60%);
          border-right:1px solid #1f2937;
        }
        .brandLogo{ display:flex; align-items:center; gap:16px; }
        .chip{
          border:2px solid #a78bfa; color:#a78bfa; padding:12px 16px; border-radius:999px;
          font-weight:800; letter-spacing:1px;
        }
        .title{ font-size:56px; font-weight:900; letter-spacing:2px; }
        .brandTag{ margin-top:14px; color:#9ca3af; letter-spacing:.08em; }

        .panel{
          display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px;
          background:#0f1220;
        }
        .tabs{ display:flex; gap:20px; margin-bottom:20px; }
        .tab{
          background:transparent; color:#9ca3af; border:none; font-weight:700; letter-spacing:.04em;
          padding:12px 8px; cursor:pointer; border-bottom:2px solid transparent;
        }
        .tab.active{ color:#e5e7eb; border-bottom-color:#facc15; } /* our theme accent */
        .form{
          width:min(430px, 92vw); background:#111827; padding:28px; border-radius:16px;
          border:1px solid #1f2937; box-shadow:0 20px 60px rgba(0,0,0,.35);
        }
        .lbl{ display:block; font-size:13px; color:#9ca3af; margin:10px 0 6px; }
        .inputRow{
          display:flex; align-items:center; gap:10px; border:1px solid #1f2937; border-radius:12px;
          padding:10px 12px; background:#0f1220;
        }
        .inputRow input{
          flex:1; background:transparent; border:none; outline:none; color:#e5e7eb; font-size:15px;
        }
        .icon{ opacity:.7 }
        .row.between{ display:flex; justify-content:flex-end; margin:10px 0 0; }
        .link{ background:none; border:none; color:#eab308; cursor:pointer; padding:0; }
        .cta{
          width:100%; margin-top:16px; padding:14px 16px; border-radius:12px; border:1px solid #facc15;
          background:linear-gradient(180deg,#facc15,#eab308); color:#0b0e14; font-weight:900; letter-spacing:.08em;
          cursor:pointer;
        }
        .cta[disabled]{ opacity:.6; cursor:not-allowed; }
        .alert{ margin-top:12px; padding:10px 12px; border-radius:10px; font-size:14px; }
        .alert.err{ background:#7f1d1d; color:#fff; }
        .alert.ok{ background:#064e3b; color:#d1fae5; }
      `}</style>
    </main>
  );
}
