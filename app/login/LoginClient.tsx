'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function LoginClient() {
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setWorking(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your inbox for a verification link.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Auth failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="left">
          <div className="brand">
            <div className="title">Only Poker</div>
            <div className="subtle">v0.1 · preview</div>
          </div>
        </div>

        <div className="right">
          <div className="tabs">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`t ${tab === 'login' ? 'active' : ''}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`t ${tab === 'signup' ? 'active' : ''}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="form">
            <label className="lbl">Email</label>
            <input
              className="in"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label className="lbl">Password</label>
            <input
              className="in"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />

            <button className="cta" disabled={working}>
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </button>

            {err && <div className="err">{err}</div>}
            {msg && <div className="msg">{msg}</div>}
          </form>
        </div>
      </div>

      <style jsx>{`
        /* ------- tokens ------- */
        :root{
          --ink:#0f172a;        /* deep black-ish text */
          --ink-2:#111111;      /* solid black */
          --ink-3:#1a1a1a;      /* light black for hover */
          --muted:#6b7280;
          --line:#e5e7eb;
          --bg:#f6f7fb;
          --ring: rgba(0,0,0,.10);  /* soft black focus ring */
        }

        /* page */
        .auth{
          min-height:100svh;
          display:grid;
          place-items:center;
          background:var(--bg);
          padding:24px;
        }

        /* card */
        .card{
          width:min(980px,92vw);
          display:grid;
          grid-template-columns:1.1fr 1fr;
          border-radius:22px;
          background:#fff;
          box-shadow:0 25px 50px rgba(16,24,40,.08),0 6px 12px rgba(16,24,40,.06);
          overflow:hidden;
        }
        @media (max-width:900px){
          .card{ grid-template-columns:1fr; }
          .left{ display:none; }
        }

        .left{
          background:linear-gradient(180deg,#fafafa 0%, #f2f4f8 100%);
          padding:56px 56px 80px;
          display:flex;
          align-items:flex-end;
        }
        .brand .title{ font-size:44px; font-weight:800; letter-spacing:-.02em; color:var(--ink); }
        .brand .subtle{ margin-top:8px; color:var(--muted); font-size:14px; }

        .right{ padding:40px 40px 46px; }

        /* tabs */
        .tabs{ display:flex; gap:22px; margin-bottom:16px; }
        .t{
          all:unset;
          cursor:pointer;
          color:#111827;
          font-weight:700;
          padding-bottom:8px;
          border-bottom:2px solid transparent;
        }
        .t.active{ border-color: var(--ink-2); } /* black underline */

        /* form */
        .form{ display:grid; gap:10px; margin-top:6px; }
        .lbl{ font-size:13px; color:#374151; font-weight:600; }

        /* inputs: pure black/white, no blue */
        .in{
          width:100%;
          border:1px solid var(--line);
          background:#ffffff !important;
          padding:12px 14px;
          border-radius:12px;
          font-size:15px;
          color:#111827;
          outline:none;
          transition:border-color .15s ease, box-shadow .15s ease;
          -webkit-text-fill-color:#111827; /* for autofill */
        }
        .in:focus{
          border-color:#111;                 /* black border on focus */
          box-shadow:0 0 0 4px var(--ring);  /* subtle black ring */
        }

        /* kill browser autofill tint (Chrome/Safari) */
        input.in:-webkit-autofill,
        input.in:-webkit-autofill:hover,
        input.in:-webkit-autofill:focus{
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          -webkit-text-fill-color:#111827 !important;
          caret-color:#111827 !important;
          border:1px solid var(--line) !important;
        }

        /* CTA button — monochrome */
        .cta{
          all:unset;
          display:block;
          width:100%;
          box-sizing:border-box;
          text-align:center;
          user-select:none;

          background:#ffffff !important;     /* white idle */
          color:#111111 !important;          /* black text idle */
          border:1px solid #111111 !important;
          padding:14px 16px;
          border-radius:12px;
          font-weight:700;
          font-size:16px;
          cursor:pointer;

          transition:
            background .18s ease,
            color .18s ease,
            transform .02s ease-in-out,
            box-shadow .18s ease,
            border-color .18s ease;
          box-shadow:0 2px 0 #000;
        }
        .cta:not(:disabled):hover{
          background: var(--ink-3) !important; /* light black */
          color:#ffffff !important;            /* white text on hover */
          transform: translateY(-.5px);
          box-shadow:0 3px 0 #000;
          border-color: var(--ink-3) !important;
        }
        .cta:not(:disabled):active{
          background: var(--ink-2) !important;  /* a bit darker on press */
          color:#ffffff !important;
          transform: translateY(.5px);
          box-shadow:0 1px 0 #000;
          border-color: var(--ink-2) !important;
        }
        .cta[disabled]{
          background:#f3f4f6 !important;
          color:#9ca3af !important;
          border-color:#e5e7eb !important;
          box-shadow:none !important;
          cursor:not-allowed !important;
        }

        .err{ margin-top:10px; color:#b91c1c; font-size:14px; }
        .msg{ margin-top:10px; color:#166534; font-size:14px; }
      `}</style>
    </div>
  );
}
