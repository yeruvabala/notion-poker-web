'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client'; // your browser helper (may return null)

export default function LoginClient() {
  const supabase = createClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Keep server cookie in sync with client auth events
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      } catch {
        /* ignore */
      }
    });
    return () => {
      sub?.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!supabase) {
      setErr('Supabase client not initialized.');
      return;
    }

    try {
      setLoading(true);

      if (tab === 'login') {
        // 1) Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // 2) Sync server cookie BEFORE redirecting
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
        });

        // 3) Redirect
        window.location.href = '/';
        return;
      }

      // === SIGNUP FLOW (logic only; UI unchanged) ===

      // 0) Hard gate: check if email already exists (case-insensitive)
      const { data: existsData, error: existsErr } = await supabase.rpc('email_exists', {
        email_input: email,
      });
      if (existsErr) {
        // If the RPC fails, fall back to normal signup handling
        // but surface a generic message so the user isn't stuck
        console.warn('email_exists RPC error:', existsErr);
      } else if (existsData === true) {
        setErr('That email is already registered. Try logging in instead.');
        return;
      }

      // 1) Create account (Supabase may send a verification email)
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // Fallback mapping if backend still returns a duplicate error
        const friendly =
          /already|exists|registered/i.test(error.message)
            ? 'That email is already registered. Try logging in instead.'
            : error.message || 'Signup failed';
        throw new Error(friendly);
      }

      // 2) If email confirmations are enabled, there is no session yet
      if (!data?.session) {
        setMsg('Account created. Check your inbox for a verification link.');
        return;
      }

      // 3) If autoconfirm is enabled: sync cookie and redirect
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
      });
      window.location.href = '/';
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        {/* Left panel */}
        <div className="left">
          <div className="brand">
            <div className="app">Only Poker</div>
            <div className="sub">v0.1 · preview</div>
          </div>
        </div>

        {/* Right panel */}
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

          <form className="form" onSubmit={handleSubmit}>
            <label className="lbl">Email</label>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="lbl">Password</label>
            <input
              className="input"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button className="cta" disabled={loading}>
              {loading ? (tab === 'login' ? 'Signing in…' : 'Creating…') : tab === 'login' ? 'Sign in' : 'Create account'}
            </button>

            {err && <div className="err">{err}</div>}
            {msg && <div className="msg">{msg}</div>}
          </form>
        </div>
      </div>

      {/* === Styles (unchanged) === */}
      <style jsx global>{`
        :root{
          --ink:#0f172a;
          --ink-2:#111111;
          --muted:#6b7280;
          --panel:#ffffff;
          --panel-2:#f6f7f8;
          --shade:#f5f5f5;
          --ring:#111111;
          --shadow: 0 20px 70px rgba(0,0,0,.08);
        }
        html,body{background:#f3f4f6;margin:0;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        *{box-sizing:border-box}

        .wrap{min-height:100dvh;display:grid;place-items:center;padding:28px;}
        .card{
          width:min(980px, 96vw);
          background:var(--panel);
          border-radius:18px;
          box-shadow:var(--shadow);
          display:grid;
          grid-template-columns: 1fr 1fr;
          overflow:hidden;
          border:1px solid #e6e6e6;
        }
        @media (max-width:980px){.card{grid-template-columns:1fr}}

        .left{
          background: radial-gradient(1200px 400px at -200px -200px, #ffffff 0%, #f7f7f7 35%, #efefef 100%);
          padding:42px 40px 48px;
          display:flex;align-items:flex-end;justify-content:flex-start;
        }
        .brand .app{font-weight:800;font-size:44px;letter-spacing:.2px}
        .brand .sub{margin-top:6px;color:var(--muted)}

        .right{padding:32px 34px 34px}

        .tabs{display:flex;gap:20px;margin-bottom:18px}
        .tab{background:transparent;border:none;cursor:pointer;padding:0 0 10px;border-bottom:2.5px solid transparent;color:var(--ink);font-weight:700;font-size:18px;}
        .tab.active{border-color:#111}

        .form{display:flex;flex-direction:column;gap:12px;max-width:520px}
        .lbl{font-size:13px;color:var(--muted)}

        .input{
          width:100%;
          padding:14px 16px;
          border:1px solid #e6e6e6;
          border-radius:12px;
          background:#fff;
          color:var(--ink);
          outline:none;
          transition:border .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .input:focus{border-color:var(--ring);box-shadow: 0 0 0 3px rgba(17,17,17,.12);background:#fff;}
        .input::placeholder{color:#9ca3af}
        .input:-webkit-autofill,
        .input:-webkit-autofill:hover,
        .input:-webkit-autofill:focus{
          -webkit-text-fill-color: var(--ink);
          caret-color: var(--ink);
          box-shadow: 0 0 0px 1000px var(--shade) inset !important;
          border:1px solid #e6e6e6 !important;
          transition: background-color 99999s ease-in-out 0s;
        }
        .input:-moz-ui-valid{background-color: var(--shade) !important;}

        /* CTA stays visually identical to your current version */
        .cta{
          margin-top: 8px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--shade);
          color: var(--ink);
          border: 1px solid #e6e6e6;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, border-color .15s ease, transform .02s ease-in-out, box-shadow .15s ease;
          box-shadow: 0 2px 0 rgba(0,0,0,.10);
        }
        .cta:not(:disabled):hover{
          background:#0a0a0a;color:#ffffff;border-color:#0a0a0a;
          transform: translateY(-0.5px); box-shadow: 0 3px 0 rgba(0,0,0,.25);
        }
        .cta:not(:disabled):active{transform: translateY(0.5px); box-shadow: 0 1px 0 rgba(0,0,0,.15);}
        .cta[disabled]{background:#f3f4f6;color:#9ca3af;border-color:#e5e7eb;box-shadow:none;cursor:not-allowed;}

        .err{margin-top:10px;color:#b91c1c;font-size:13px}
        .msg{margin-top:10px;color:#065f46;font-size:13px}
      `}</style>
    </div>
  );
}
