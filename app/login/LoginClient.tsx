'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client'; // your browser helper (may return null)
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";

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
    <div className="op-surface login-page">
      {/* Centered Login Card */}
      <div className="login-card platinum-container-frame">
        {/* Header with Metallic Gradient - matching home page exactly */}
        <h1 className="login-title platinum-text-gradient">Only Poker</h1>

        {/* Card Suits with decorative lines - matching home page */}
        <div className="login-suits-row">
          <div className="login-line-left"></div>
          <div className="login-suits">
            <span className="login-suit">♠</span>
            <span className="login-suit">♥</span>
            <span className="login-suit">♣</span>
            <span className="login-suit">♦</span>
          </div>
          <div className="login-line-right"></div>
        </div>

        <p className="login-subtitle">v0.1 · preview</p>

        {/* Tab Switcher */}
        <div className="login-tabs">
          <button
            className={`login-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => setTab('login')}
            type="button"
          >
            Log in
          </button>
          <button
            className={`login-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => setTab('signup')}
            type="button"
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">Email</label>
          <input
            className="login-input input-ony platinum-inner-border"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="login-label">Password</label>
          <input
            className="login-input input-ony platinum-inner-border"
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="login-cta btn-platinum-premium" disabled={loading}>
            {loading ? (tab === 'login' ? 'Signing in…' : 'Creating…') : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {err && <div className="login-err">{err}</div>}
          {msg && <div className="login-msg">{msg}</div>}
        </form>
      </div>

      {/* === Dark Mode Platinum Theme Styles matching home page === */}
      <style jsx global>{`
        /* Page Background - matching home page #1c1c1c */
        .login-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px;
          background: #1c1c1c !important;
        }

        /* Override global body for login */
        html, body {
          margin: 0;
          background: #1c1c1c !important;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }

        /* The Centered Card - using platinum-container-frame from globals */
        .login-card {
          width: 100%;
          max-width: 450px;
          padding: 40px 36px;
        }

        /* Header - Matching home page style (centered, no italics) */
        .login-title {
          text-align: center;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: 1px;
          margin: 0 0 12px;
          text-transform: uppercase;
          /* Override inline-block from platinum-text-gradient to center properly */
          display: block !important;
          width: 100%;
        }

        /* Card suits row with decorative lines */
        .login-suits-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 8px;
          opacity: 0.9;
        }

        .login-line-left {
          height: 1px;
          width: 80px;
          background: linear-gradient(90deg, transparent, #a3a3a3);
        }

        .login-line-right {
          height: 1px;
          width: 80px;
          background: linear-gradient(90deg, #a3a3a3, transparent);
        }

        .login-suits {
          font-size: 18px;
          letter-spacing: 6px;
          line-height: 1;
        }

        .login-suit {
          color: #e5e7eb;
          text-shadow: 0 0 10px rgba(229, 231, 235, 0.4);
        }

        .login-subtitle {
          text-align: center;
          font-size: 14px;
          margin: 0 0 28px;
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 40%, #94A3B8 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }

        /* Tab Switcher */
        .login-tabs {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
          justify-content: center;
        }

        .login-tab {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0 0 8px;
          border-bottom: 2px solid transparent;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.2s ease;
          /* Metallic gradient for inactive tabs */
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 40%, #94A3B8 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }

        .login-tab:hover {
          background: linear-gradient(to right, #6b7280 0%, #E2E8F0 40%, #E2E8F0 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }

        .login-tab.active {
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          border-color: #E2E8F0;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Labels - Metallic gradient matching home page */
        .login-label {
          font-size: 13px;
          font-weight: 500;
          margin-bottom: -4px;
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
        }

        /* Input Fields - matching home page input-ony style */
        .login-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          background: #262626 !important;
          color: #E2E8F0 !important;
          -webkit-text-fill-color: #E2E8F0 !important;
        }

        /* Autofill Override - match password box background (#262626) */
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #E2E8F0 !important;
          caret-color: #E2E8F0;
          -webkit-box-shadow: 0 0 0px 1000px #262626 inset !important;
          box-shadow: 0 0 0px 1000px #262626 inset !important;
          background-color: #262626 !important;
          border-color: #a3a3a3 !important;
          transition: background-color 99999s ease-in-out 0s;
        }

        /* CTA Button - using btn-platinum-premium from globals */
        .login-cta {
          margin-top: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
        }

        .login-cta[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Error & Success Messages */
        .login-err {
          margin-top: 10px;
          color: #ef4444 !important;
          -webkit-text-fill-color: #ef4444 !important;
          background: none !important;
          font-size: 13px;
          text-align: center;
        }

        .login-msg {
          margin-top: 10px;
          color: #22c55e !important;
          -webkit-text-fill-color: #22c55e !important;
          background: none !important;
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
