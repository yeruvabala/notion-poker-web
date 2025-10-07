'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginClient() {
  const supabase = createClient();

  const [tab, setTab] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setWorking(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password
          // If you use email confirmation, configure in Supabase dashboard.
        });
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
        {/* LEFT brand area */}
        <div className="left">
          <div className="brand">
            <div className="title">Only Poker</div>
            <div className="subtle">v0.1 · preview</div>
          </div>
        </div>

        {/* RIGHT form */}
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

      {/* SCOPED styles */}
      <style jsx>{`
        :root { --platinum: #e5e4e2; }

        .auth{
          min-height: 100svh;
          display: grid;
          place-items: center;
          background: #f6f7fb;
          padding: 24px;
        }
        .card{
          width: min(980px, 92vw);
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 0;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 25px 50px rgba(16,24,40,.08), 0 6px 12px rgba(16,24,40,.06);
          overflow: hidden;
        }
        @media (max-width: 900px){
          .card{ grid-template-columns: 1fr; }
          .left{ display: none; }
        }
        .left{
          background: linear-gradient(180deg, #f9fafb 0%, #eef2ff 100%);
          padding: 56px 56px 80px;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
        }
        .brand .title{
          font-size: 44px; /* toned down */
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .brand .subtle{
          margin-top: 8px;
          color: #6b7280;
          font-size: 14px;
        }
        .right{
          padding: 40px 40px 46px;
        }
        .tabs{
          display: flex;
          gap: 22px;
          margin-bottom: 16px;
        }
        .t{
          all: unset;
          cursor: pointer;
          color: #111827;
          font-weight: 700;
          padding-bottom: 8px;
          border-bottom: 2px solid transparent;
        }
        .t.active{
          border-color: #0b62ff;
        }
        .form{
          display: grid;
          gap: 10px;
          margin-top: 6px;
        }
        .lbl{
          font-size: 13px;
          color: #374151;
          font-weight: 600;
        }
        .in{
          width: 100%;
          border: 1px solid #e5e7eb;
          background: #fff;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 15px;
          color: #111827;
          outline: none;
        }
        .in:focus{
          border-color: #c7d2fe;
          box-shadow: 0 0 0 4px rgba(99,102,241,.12);
        }

        /* ====== HARD RESET THE CTA then rebuild ====== */
        .cta{
          all: unset;                    /* wipe any global button styles */
          display: block;
          width: 100%;
          box-sizing: border-box;
          text-align: center;
          user-select: none;
          /* default (idle): white bg + dark text + black border */
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #111 !important;
          padding: 14px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .02s ease-in-out, box-shadow .18s ease, border-color .18s ease;
          box-shadow: 0 2px 0 #000;
        }
        /* Hover (enabled): full black + platinum text */
        .cta:not(:disabled):hover{
          background: #0a0a0a !important;
          color: var(--platinum) !important;
          transform: translateY(-0.5px);
          box-shadow: 0 3px 0 #000;
          border-color: #0a0a0a !important;
        }
        /* Active press effect */
        .cta:not(:disabled):active{
          transform: translateY(0.5px);
          box-shadow: 0 1px 0 #000;
        }
        /* Disabled: light gray; never turns black */
        .cta[disabled]{
          background: #f3f4f6 !important;
          color: #9ca3af !important;
          border-color: #e5e7eb !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
        }

        .err{ margin-top: 10px; color: #b91c1c; font-size: 14px; }
        .msg{ margin-top: 10px; color: #166534; font-size: 14px; }
      `}</style>
    </div>
  );
}
