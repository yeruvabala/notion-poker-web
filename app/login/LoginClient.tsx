'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// If your helper is at a different path, adjust this import:
import { createBrowserClient } from '@/lib/supabase/browser';

type Mode = 'login' | 'register';

export default function LoginClient() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/'); // go home when signed-in
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setMsg('Account created. Check your inbox for a verification link.');
        setMode('login');
      }
    } catch (e: any) {
      setErr(e?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;

  return (
    <main className="loginWrap">
      <div className="box">
        {/* LEFT brand panel */}
        <div className="brand">
          <div className="brandInner">
            <div className="brandTitle">Only Poker</div>
            <div className="brandSub">v0.1 · preview</div>
          </div>
        </div>

        {/* RIGHT auth panel */}
        <div className="auth">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="form">
            <label className="lbl">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label className="lbl">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            <button className="cta" disabled={!canSubmit}>
              {mode === 'login' ? (loading ? 'Signing in…' : 'Sign in') : (loading ? 'Creating…' : 'Create account')}
            </button>

            {err && <div className="err">{err}</div>}
            {msg && <div className="note">{msg}</div>}
          </form>
        </div>
      </div>

      <style jsx>{`
        :root{
          --card:#ffffff;
          --line:#e5e7eb;
          --text:#0f172a;
          --muted:#6b7280;
          --brandGrad: radial-gradient(1200px 700px at -10% -30%, #eef2ff 0%, #ffffff 55%);
          --platinum:#E5E4E2;
          --shadow: 0 40px 120px rgba(0,0,0,.10), 0 4px 18px rgba(0,0,0,.05);
        }
        html,body{background:#f5f7fb;color:var(--text)}
        .loginWrap{
          padding:48px 20px;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          min-height:100dvh;
        }
        .box{
          width: min(1080px, 95vw);
          display:grid;
          grid-template-columns: 1.05fr 1fr;
          border-radius:26px;
          background:var(--card);
          box-shadow: var(--shadow);
          overflow:hidden;
          border:1px solid var(--line);
        }
        @media (max-width: 980px){
          .box{ grid-template-columns: 1fr; }
          .brand{ min-height: 140px; }
        }

        /* LEFT panel */
        .brand{
          background: var(--brandGrad);
          padding: 56px 54px;
          display:flex;
          align-items:center;
          justify-content:flex-start;
        }
        .brandInner{
          transform: translateY(2px);
        }
        .brandTitle{
          font-size: clamp(34px, 5.2vw, 52px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color:#0f172a;
        }
        .brandSub{
          margin-top: 10px;
          color: var(--muted);
          font-size: 16px;
          font-weight: 500;
        }

        /* RIGHT panel */
        .auth{
          padding: 36px 34px 30px;
        }
        .tabs{
          display:flex;
          gap: 22px;
          margin: 8px 0 18px;
        }
        .tab{
          color:#0f172a;
          font-weight: 800;
          font-size: 18px;
          background:transparent;
          border:none;
          padding: 8px 2px;
          cursor:pointer;
          border-bottom: 3px solid transparent;
        }
        .tab.active{
          border-color:#0f172a;
        }
        /* Remove the big blue focus ring; keep a subtle one */
        .tab:focus{ outline:none; }
        .tab:focus-visible{
          outline:2px solid #94a3b8;
          outline-offset:2px;
          border-radius:6px;
        }

        .form{
          display:grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        .lbl{
          margin-top: 8px;
          font-size: 14px;
          color:#111827;
          font-weight: 700;
        }
        .input{
          border:1px solid var(--line);
          border-radius: 12px;
          padding: 14px 14px;
          font-size: 16px;
          background:#fff;
        }
        .input:focus{
          outline: 3px solid #c7d2fe;
          border-color: #c7d2fe;
        }

        /* ==== Button states ==== */
        /* Default: white background, black text */
        .cta{
          margin-top: 6px;
          border: 1px solid #111;
          background: #ffffff;
          color: #0f172a;                 /* black/dark text by default */
          padding: 14px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .02s ease-in-out, box-shadow .18s ease;
          box-shadow: 0 2px 0 #000;        /* subtle “raised” look */
        }
        /* Hover: whole button black, text platinum */
        .cta:not(:disabled):hover{
          background:#0a0a0a;             /* black */
          color: var(--platinum);          /* platinum label */
          transform: translateY(-0.5px);
          box-shadow: 0 3px 0 #000;
        }
        /* Active press */
        .cta:not(:disabled):active{
          transform: translateY(0.5px);
          box-shadow: 0 1px 0 #000;
        }
        /* Disabled */
        .cta[disabled]{
          background:#f3f4f6;
          color:#9ca3af;
          border-color:#e5e7eb;
          box-shadow:none;
          cursor:not-allowed;
        }

        .err{
          margin-top: 6px;
          color:#b91c1c;
          font-weight:600;
        }
        .note{
          margin-top: 6px;
          color:#065f46;
          font-weight:600;
        }
      `}</style>
    </main>
  );
}
