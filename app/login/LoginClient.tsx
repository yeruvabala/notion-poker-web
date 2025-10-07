'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const supabase = createClient(); // may be null in rare misconfig; we guard below

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!supabase) {
      setErr('Supabase client not initialized. Check env vars.');
      return;
    }

    try {
      setSubmitting(true);

      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        // Email-link verification (no Google)
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your inbox for a verification link.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shell">
      <div className="card">
        {/* Left side */}
        <div className="left">
          <div className="brand">Only Poker</div>
          <div className="version">v0.1 · preview</div>
        </div>

        {/* Right side */}
        <div className="right">
          <div className="tabs">
            <button
              className={`tabBtn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
              type="button"
            >
              Log in
            </button>
            <button
              className={`tabBtn ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => setTab('signup')}
              type="button"
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
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <label className="lbl">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />

            <button className="btnBW" disabled={submitting}>
              {submitting ? (tab === 'login' ? 'Signing in…' : 'Creating…') : (tab === 'login' ? 'Sign in' : 'Create account')}
            </button>

            {err && <div className="note err">{err}</div>}
            {msg && <div className="note ok">{msg}</div>}
          </form>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        :root{
          --ink:#0f172a;            /* near-black text */
          --ink-2:#111111;          /* black for strokes/focus/button */
          --ink-3:#1a1a1a;          /* lighter black hover */
          --paper:#ffffff;          /* white */
          --paper-2:#f7f7f7;        /* light gray (fields) */
          --muted:#6b7280;          /* secondary text */
          --shadow: 0 40px 80px rgba(0,0,0,.08), 0 12px 24px rgba(0,0,0,.05);
        }

        .shell{
          min-height:100dvh;
          display:flex;
          align-items:center;
          justify-content:center;
          background: #f3f4f6;
          padding: 28px;
        }

        .card{
          width:min(1040px, 92vw);
          display:grid;
          grid-template-columns: 1fr 1fr;
          background:var(--paper);
          border-radius:20px;
          box-shadow: var(--shadow);
          overflow:hidden;
        }

        .left{
          padding:40px 44px 44px;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          background: radial-gradient(120% 140% at 20% 10%, #ffffff 0%, #f7f7f7 60%, #f1f1f1 100%);
          border-right:1px solid #efefef;
        }

        .brand{
          font-size:40px;
          line-height:1.1;
          font-weight:800;
          letter-spacing:-0.015em;
          color:var(--ink);
        }

        .version{
          margin-top:8px;
          color:var(--muted);
          font-size:14px;
        }

        .right{
          padding:40px 44px;
          display:flex;
          flex-direction:column;
        }

        .tabs{
          display:flex;
          gap:22px;
          margin-bottom:18px;
        }
        .tabBtn{
          border:none;
          background:transparent;
          color:var(--ink);
          font-weight:600;
          font-size:16px;
          padding:0 0 8px;
          cursor:pointer;
          position:relative;
        }
        .tabBtn.active::after{
          content:'';
          position:absolute;
          left:0; right:0; bottom:-2px;
          height:2px;
          background: var(--ink-2); /* black underline */
          border-radius:2px;
        }

        .form{
          display:flex;
          flex-direction:column;
          gap:10px;
          margin-top:4px;
        }
        .lbl{
          font-size:13px;
          color:var(--muted);
          margin-top:6px;
        }

        .input{
          height:48px;
          border-radius:12px;
          border:1px solid #e6e6e6;
          background: var(--paper-2);       /* light neutral (no blue) */
          padding: 0 14px;
          font-size:16px;
          color:var(--ink);
          outline:none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .input::placeholder{ color:#9aa0a6; }
        .input:focus{
          border-color: var(--ink-2);        /* black focus */
          box-shadow: 0 0 0 3px rgba(17,17,17,.06);
          background:#fafafa;
        }

        /* Black&White CTA: solid black, white text, notches a shade lighter on hover */
        .btnBW{
          margin-top:14px;
          height:50px;
          border-radius:12px;
          border:1px solid var(--ink-2);
          background: var(--ink-2);
          color: #ffffff;
          font-weight:800;
          font-size:16px;
          letter-spacing:.2px;
          cursor:pointer;
          transition: background .15s ease, transform .02s ease-in-out, box-shadow .15s ease;
          box-shadow: 0 2px 0 #000;
        }
        .btnBW:hover:not(:disabled){
          background: var(--ink-3);          /* lighter black on hover */
          box-shadow: 0 3px 0 #000;
          transform: translateY(-0.5px);
        }
        .btnBW:active:not(:disabled){
          transform: translateY(0.5px);
          box-shadow: 0 1px 0 #000;
        }
        .btnBW:disabled{
          opacity:.6;
          cursor:not-allowed;
        }

        .note{
          margin-top:10px;
          font-size:14px;
        }
        .note.err{ color:#b91c1c; }
        .note.ok{ color:#166534; }

        @media (max-width: 920px){
          .card{ grid-template-columns: 1fr; }
          .left{ border-right: none; border-bottom:1px solid #efefef; }
          .brand{ font-size:32px; }
        }
      `}</style>
    </div>
  );
}
