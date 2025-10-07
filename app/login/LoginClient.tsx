'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const supabase = createClient();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Keep server cookies in sync (fixes the “login twice” problem in some hosts)
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        try {
          await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, session }),
          });
        } catch {
          // ignore
        }
      }
    });
    return () => sub?.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setMsg(null);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Check your email for the verification link.');
      }
    } catch (err: any) {
      setMsg(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="left">
          <h1 className="brand">Only Poker</h1>
          <p className="tag">v0.1 · preview</p>
        </div>

        <div className="right">
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

          <form onSubmit={onSubmit} className="form">
            <label className="label">Email</label>
            <div className="field">
              <input
                className="control email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <label className="label">Password</label>
            <div className="field">
              <input
                className="control"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button className="cta" disabled={submitting} type="submit">
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </button>

            {tab === 'login' && (
              <p className="reset">
                Forgot your password? <a href="/reset">Reset</a>
              </p>
            )}

            {msg && <p className="msg">{msg}</p>}
          </form>
        </div>
      </div>

      <style jsx>{`
        /* ---------- THEME (exact neutral, not blue) ---------- */
        :root{
          /* Shared neutral used for left panel + shells (email filled/focus + button idle) */
          --shell: #eceff3;        /* soft grey with no blue cast */
          --panelFrom: #fafbfc;     /* very light paper */
          --panelTo:   #eef2f7;     /* subtle gradient end (warm grey) */
          --ink: #0f172a;           /* text */
          --ink-2: #334155;         /* secondary text */
          --ring: #d7dbe0;          /* focus ring */
          --border: #e5e7eb;        /* borders */
          --shadow: 0 30px 60px rgba(2,6,23,.06), 0 12px 24px rgba(2,6,23,.04);
        }

        .wrap{
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: #f6f7f9;
          padding: 24px;
        }

        .card{
          width: min(1060px, 92vw);
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          background: #fff;
          border-radius: 22px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .left{
          background: linear-gradient(180deg, var(--panelFrom), var(--panelTo));
          padding: 56px 64px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .brand{ margin: 0; font-size: 46px; line-height: 1.1; color: var(--ink); }
        .tag{ margin-top: 8px; color: var(--ink-2); }

        .right{ padding: 42px 40px 48px; }

        .tabs{ display: flex; gap: 24px; margin-bottom: 22px; }
        .tab{
          background: transparent;
          border: 0;
          font-weight: 700;
          color: var(--ink-2);
          padding: 0 0 6px;
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        .tab.active{
          color: var(--ink);
          border-bottom-color: var(--ink);
        }

        .form{ display: grid; gap: 14px; }
        .label{ font-size: 14px; color: var(--ink-2); }

        .field{
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0;
          background: #fff; /* default */
          transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .field:focus-within{
          background: var(--shell);      /* focus shell matches left panel */
          border-color: var(--ring);
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 40%, transparent);
        }

        .control{
          width: 100%;
          padding: 14px 16px;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--ink);
          font-size: 16px;
          border-radius: 12px;
        }

        /* Email looks like the panel once it has a value (no blue) */
        .email:not(:placeholder-shown){
          background: var(--shell);
        }

        /* CTA: matches shell by default, turns black on hover */
        .cta{
          margin-top: 12px;
          width: 100%;
          border-radius: 14px;
          border: 1px solid #111;
          background: var(--shell);      /* same as email filled + panel vibe */
          color: var(--ink);
          font-weight: 800;
          padding: 14px 18px;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .02s ease-in-out, box-shadow .18s ease;
          box-shadow: 0 2px 0 #000;
        }
        .cta:not(:disabled):hover{
          background: #0a0a0a;          /* full black */
          color: #ffffff;
          transform: translateY(-0.5px);
          box-shadow: 0 3px 0 #000;
        }
        .cta:disabled{
          opacity: .7;
          cursor: not-allowed;
        }

        .reset{ margin-top: 10px; font-size: 14px; color: var(--ink-2); }
        .reset a{ color: var(--ink); font-weight: 600; text-decoration: underline; }

        .msg{ margin-top: 10px; color: var(--ink-2); }

        @media (max-width: 980px){
          .card{ grid-template-columns: 1fr; }
          .left{ padding: 36px 28px 28px; }
          .right{ padding: 28px; }
          .brand{ font-size: 38px; }
        }
      `}</style>
    </div>
  );
}
