'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client'; // <- adjust path if different

/* ---------- Suits (SVG) ---------- */
function Spade({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#0f172a">
      <path d="M12 2c-3.8 3.9-8 6.8-8 10.4A3.6 3.6 0 0 0 7.7 16c.8 0 1.5-.3 2.1-.7-.2.9-.7 2-1.7 3.1-.2.2-.1.6.2.6h7.4c.3 0 .4-.4.2-.6-1-1.1-1.5-2.2-1.7-3.1.6.4 1.3.7 2.1.7a3.6 3.6 0 0 0 3.7-3.6C20 8.8 15.8 5.9 12 2Z"/>
    </svg>
  );
}
function Heart({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#0f172a">
      <path d="M12 21s-7.5-5.6-9.6-9C1.2 9.3 2 6.5 4.6 5.3 6.6 4.4 8.9 5 10.3 6.7L12 8.6l1.7-1.9C15.1 5 17.4 4.4 19.4 5.3 22 6.5 22.8 9.3 21.6 12c-2.1 3.4-9.6 9-9.6 9Z"/>
    </svg>
  );
}
function Club({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#0f172a">
      <path d="M12 9a3.5 3.5 0 1 1 3.3-4.6A3.5 3.5 0 1 1 20 12a3.5 3.5 0 0 1-4.4 3.3c.2.9.7 2.1 1.6 3.2.2.2.1.5-.2.5h-9c-.3 0-.4-.3-.2-.5.9-1.1 1.4-2.3 1.6-3.2A3.5 3.5 0 1 1 12 9Zm-1.4 8h2.8c-.3-1.3-.6-2.7-.6-3.6h-1.6c0 .9-.3 2.3-.6 3.6Z"/>
    </svg>
  );
}
function Diamond({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#0f172a">
      <path d="M12 2 4 12l8 10 8-10-8-10Z"/>
    </svg>
  );
}

function SuitsRow() {
  return (
    <div className="suitsRow" aria-hidden>
      <Spade />
      <Heart />
      <Club />
      <Diamond />
      <style jsx>{`
        .suitsRow{
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 22px;
          margin: 18px 0 8px;
          user-select:none;
        }
        @media (max-width: 640px){
          .suitsRow{ gap:14px; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Login Client ---------- */
export default function LoginClient() {
  const supabase = createClient(); // your helper returns SupabaseClient | null
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!supabase) {
      setMsg('Supabase is not configured.');
      return;
    }
    try {
      setBusy(true);
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your inbox to verify, then log in.');
      }
    } catch (err: any) {
      setMsg(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      {/* Suits row above the card */}
      <SuitsRow />

      <div className="card">
        {/* Left column */}
        <div className="left">
          <div className="brand">
            <h1>Only Poker</h1>
            <p>v0.1 · preview</p>
          </div>
          <div className="leftFade" />
        </div>

        {/* Right column */}
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
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />

            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            {msg && <div className="msg">{msg}</div>}

            <button className="cta" disabled={busy}>
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        :root{
          --ink:#0f172a;         /* near black */
          --ink-weak:#111827;    /* darker for borders */
          --ink-soft:#1f2937;    /* softer text if needed */
          --paper:#ffffff;
          --paper-weak:#f8fafc;
          --paper-tint:#f3f4f6;  /* soft black-tinted background */
        }

        .wrap{
          min-height:100dvh;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:flex-start;
          background:#f6f7f9;
          padding:40px 16px 56px;
        }

        .card{
          width: min(980px, 95vw);
          border-radius:22px;
          background:var(--paper);
          box-shadow:
            0 40px 100px rgba(15,23,42,.10),
            0 10px 20px rgba(15,23,42,.04);
          overflow:hidden;
          display:grid;
          grid-template-columns: 1.1fr 1fr;
          gap:0;
        }

        /* Left */
        .left{
          position:relative;
          padding:40px 46px;
          background: linear-gradient(180deg,#fff 0%, #f7f8fa 50%, #f4f5f7 100%);
        }
        .brand h1{
          font-size:40px;
          line-height:1.1;
          margin: 12px 0 8px;
          color:var(--ink);
          font-weight:800;
          letter-spacing:-.02em;
        }
        .brand p{
          margin:0;
          color:#6b7280;
          font-weight:500;
        }
        .leftFade{
          position:absolute;
          inset:auto 0 0 0;
          height:120px;
          background: radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.06), transparent 60%);
          pointer-events:none;
        }

        /* Right */
        .right{
          padding:28px 28px 32px;
          background:var(--paper);
        }
        .tabs{
          display:flex;
          gap:18px;
          margin: 4px 0 18px;
        }
        .tab{
          position:relative;
          appearance:none;
          background:transparent;
          border:0;
          padding:6px 6px 10px;
          font-weight:700;
          color:var(--ink);
          cursor:pointer;
        }
        .tab.active::after{
          content:'';
          position:absolute;
          left:0; right:0; bottom:0;
          height:3px;
          background:var(--ink);   /* black underline */
          border-radius:2px;
        }

        .form{
          display:flex;
          flex-direction:column;
          gap:14px;
          margin-top:6px;
        }
        .label{
          font-size:14px;
          font-weight:700;
          color:var(--ink);
        }
        .input{
          padding:14px 16px;
          border-radius:12px;
          border:1px solid #e5e7eb;
          background:#f1f2f4;         /* soft blackish (no blue) */
          color:var(--ink);
          outline:none;
          transition:border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .input:focus{
          border-color:#1f2937;
          box-shadow:0 0 0 3px rgba(17,24,39,.12);
          background:#eef0f2;
        }

        /* CTA: starts soft-black like the email box, hover = full black + white text */
        .cta{
          margin-top:6px;
          border:1px solid #0b0b0b;
          background:#171717;        /* soft black */
          color:#f9fafb;              /* white-ish */
          padding:14px 16px;
          border-radius:12px;
          font-weight:800;
          font-size:16px;
          cursor:pointer;
          transition:background .18s ease, color .18s ease, transform .02s ease-in-out, box-shadow .18s ease;
          box-shadow: 0 2px 0 #000;
        }
        .cta:not(:disabled):hover{
          background:#0a0a0a;        /* full black on hover */
          color:#ffffff;
          transform: translateY(-0.5px);
          box-shadow: 0 3px 0 #000;
        }
        .cta:not(:disabled):active{
          transform: translateY(0.5px);
          box-shadow: 0 1px 0 #000;
        }
        .cta[disabled]{
          background:#e5e7eb;
          color:#9ca3af;
          border-color:#e5e7eb;
          box-shadow:none;
          cursor:not-allowed;
        }

        .msg{
          margin-top:2px;
          padding:10px 12px;
          border-radius:10px;
          background:#f8fafc;
          color:#0f172a;
          border:1px solid #e5e7eb;
          font-size:14px;
        }

        /* layout tweaks */
        @media (max-width: 940px){
          .card{ grid-template-columns: 1fr; }
          .left{ padding:28px 28px 22px; }
          .brand h1{ font-size:34px; }
        }
      `}</style>
    </div>
  );
}
