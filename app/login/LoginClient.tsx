'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client'; // your browser helper

export default function LoginClient() {
  const supabase = createClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // keep server cookies in sync while the page is open
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (event, session) => {
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
      sub?.data?.subscription?.unsubscribe();
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
        // 1) sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // 2) sync server cookie BEFORE redirecting
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
        });

        // 3) redirect
        window.location.href = '/';
        return;
      }

      // === SIGNUP FLOW ===
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        // map Supabase duplicate email to a friendly message
        const friendly = /already|exists|registered/i.test(error.message)
          ? 'That email is already registered. Try logging in instead.'
          : error.message;
        throw new Error(friendly);
      }

      // If email confirmation is ON, session will be null and Supabase sent an email
      if (!data.session) {
        setMsg('Check your email to confirm your account.');
        return;
      }

      // If you allow autoconfirm, sync and redirect
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
        {/* Left */}
        <div className="left">
          <div className="brand">
            <div className="app">Only Poker</div>
            <div className="sub">v0.1 · preview</div>
          </div>
        </div>

        {/* Right */}
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

          <form onSubmit={handleSubmit} className="form">
            <label className="lbl">Email</label>
            <input
              className="input"
              type="email"
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
              {loading
                ? tab === 'login'
                  ? 'Signing in…'
                  : 'Creating…'
                : tab === 'login'
                ? 'Sign in'
                : 'Create account'}
            </button>

            {err && <div className="err">{err}</div>}
            {msg && <div className="msg">{msg}</div>}
          </form>
        </div>
      </div>

      {/* Styles keep your original look & feel */}
      <style jsx global>{`
        :root{--ink:#0f172a;--muted:#6b7280;}
        .wrap{min-height:100vh;display:grid;place-items:center;background:#f8fafc}
        .card{display:grid;grid-template-columns:1fr 1fr;max-width:900px;width:100%;
          background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.08);overflow:hidden}
        .left{background:linear-gradient(135deg,#f3f4f6,#f9fafb);padding:48px}
        .brand .app{font-weight:800;font-size:28px;color:#0b1220}
        .brand .sub{color:#64748b;margin-top:6px}
        .right{padding:32px}
        .tabs{display:flex;gap:8px;margin-bottom:16px}
        .tab{border:none;background:transparent;padding:8px 12px;border-radius:8px;color:#6b7280;
          font-weight:600;cursor:pointer}
        .tab.active{background:#111827;color:#fff}
        .form{display:grid;gap:10px}
        .lbl{font-size:12px;color:#374151}
        .input{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px}
        .cta{margin-top:10px;border:1px solid #111827;background:#111827;color:#fff;border-radius:10px;
          padding:10px 12px;font-weight:700;cursor:pointer}
        .cta[disabled]{opacity:.6;cursor:not-allowed}
        .err{margin-top:10px;color:#b91c1c;font-size:13px}
        .msg{margin-top:10px;color:#065f46;font-size:13px}
        @media (max-width:860px){.card{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
