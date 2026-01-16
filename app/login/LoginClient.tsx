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

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);

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

  // Handle forgot password request
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg(null);
    setForgotErr(null);

    if (!supabase) {
      setForgotErr('Unable to connect. Please try again.');
      return;
    }

    if (!forgotEmail.trim()) {
      setForgotErr('Please enter your email address.');
      return;
    }

    try {
      setForgotLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) throw error;

      // Success - show generic message (security: don't reveal if email exists)
      setForgotMsg('If an account exists with this email, you will receive a password reset link shortly.');
      setForgotEmail('');
    } catch (e: any) {
      // Generic error message for security
      setForgotErr('Unable to process request. Please try again later.');
      console.error('Reset password error:', e);
    } finally {
      setForgotLoading(false);
    }
  }

  // Open forgot modal and pre-fill email if available
  function openForgotModal() {
    setForgotEmail(email); // Pre-fill with login email if entered
    setForgotMsg(null);
    setForgotErr(null);
    setShowForgotModal(true);
  }

  return (
    <div className="op-surface login-page">
      {/* Centered Login Card - Thin elegant border */}
      <div className="login-card platinum-inner-border">
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

          {/* Forgot password link - only show on login tab */}
          {tab === 'login' && (
            <button
              type="button"
              className="forgot-link"
              onClick={openForgotModal}
            >
              Forgot password?
            </button>
          )}

          <button className="login-cta btn-platinum-premium" disabled={loading}>
            {loading ? (tab === 'login' ? 'Signing in…' : 'Creating…') : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {err && <div className="login-err">{err}</div>}
          {msg && <div className="login-msg">{msg}</div>}
        </form>
      </div>

      {/* Forgot Password Modal Overlay */}
      {showForgotModal && (
        <div className="forgot-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal" onClick={(e) => e.stopPropagation()}>
            <button className="forgot-close" onClick={() => setShowForgotModal(false)}>×</button>

            <h2 className="forgot-title">Reset Password</h2>
            <p className="forgot-subtitle">Enter your email and we'll send you a reset link</p>

            <form onSubmit={handleForgotPassword}>
              <input
                className="login-input forgot-input"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                autoFocus
                required
              />

              <button
                type="submit"
                className="forgot-submit"
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <span className="forgot-loading">Sending…</span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            {forgotErr && <div className="forgot-error">{forgotErr}</div>}
            {forgotMsg && (
              <div className="forgot-success">
                <span className="forgot-check">✓</span>
                {forgotMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Dark Mode Platinum Theme Styles matching home page === */}
      <style jsx global>{`
        /* Page Background - matching home page #1c1c1c with subtle grid pattern */
        .login-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px;
          background: #1c1c1c !important;
          position: relative;
        }

        /* Subtle background grid pattern like home page */
        .login-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
        }

        /* Override global body for login */
        html, body {
          margin: 0;
          background: #1c1c1c !important;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }

        /* The Centered Card - Custom thicker platinum border */
        .login-card {
          width: 100%;
          max-width: 450px;
          padding: 40px 36px;
          position: relative;
          z-index: 1;
          background: linear-gradient(#1e1e1e, #1e1e1e) padding-box,
                      linear-gradient(135deg, rgba(120,120,120,0.4) 0%, rgba(200,200,200,0.6) 25%, rgba(180,180,180,0.3) 50%, rgba(200,200,200,0.6) 75%, rgba(120,120,120,0.4) 100%) border-box !important;
          border: 1.5px solid transparent !important;
          border-radius: 16px;
        }

        /* Header - ANIMATED Title matching home page exactly */
        @keyframes title-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .login-title {
          text-align: center;
          display: block;
          width: 100%;
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0 auto 12px;
          text-transform: uppercase;
          /* Animated shimmer gradient like home page */
          background: linear-gradient(90deg,
            #888888 0%,
            #c0c0c0 20%,
            #ffffff 40%,
            #ffffff 60%,
            #c0c0c0 80%,
            #888888 100%) !important;
          background-size: 200% 100% !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          animation: title-gradient-shift 8s ease-in-out infinite;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
        }

        /* Card suits row with decorative lines */
        .login-suits-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .login-line-left {
          height: 1px;
          width: 80px;
          background: linear-gradient(90deg, transparent, rgba(200, 200, 200, 0.5));
        }

        .login-line-right {
          height: 1px;
          width: 80px;
          background: linear-gradient(90deg, rgba(200, 200, 200, 0.5), transparent);
        }

        .login-suits {
          font-size: 1.1rem;
          letter-spacing: 6px;
          line-height: 1;
          display: flex;
          gap: 6px;
        }

        /* Suit shimmer animation matching home page */
        @keyframes suit-pulse {
          0%, 100% {
            opacity: 0.6;
            filter: brightness(1);
          }
          50% {
            opacity: 1;
            filter: brightness(1.5);
          }
        }

        /* Spade - Grey/Silver */
        .login-suit:nth-child(1) {
          color: #9ca3af;
          animation: suit-pulse 3s ease-in-out infinite;
          animation-delay: 0s;
        }

        /* Heart - Red */
        .login-suit:nth-child(2) {
          color: #f87171;
          animation: suit-pulse 3s ease-in-out infinite;
          animation-delay: 0.5s;
        }

        /* Club - Grey/Silver */
        .login-suit:nth-child(3) {
          color: #9ca3af;
          animation: suit-pulse 3s ease-in-out infinite;
          animation-delay: 1s;
        }

        /* Diamond - Red */
        .login-suit:nth-child(4) {
          color: #f87171;
          animation: suit-pulse 3s ease-in-out infinite;
          animation-delay: 1.5s;
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
          border-color: rgba(200, 200, 200, 0.5);
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

        /* Input Fields - Premium platinum styling */
        @keyframes focus-flash {
          0% { 
            box-shadow: 0 0 0 0 rgba(200, 200, 200, 0.4);
          }
          50% { 
            box-shadow: 0 0 0 3px rgba(200, 200, 200, 0.15), 0 0 20px rgba(180, 180, 180, 0.15);
          }
          100% { 
            box-shadow: 0 0 0 1.5px rgba(180, 180, 180, 0.3), 0 0 12px rgba(160, 160, 160, 0.1);
          }
        }

        /* AGGRESSIVE overrides to remove ALL blue focus rings */
        .login-input,
        .login-input:focus,
        .login-input:focus-visible,
        .login-input:focus-within,
        input.login-input,
        input.login-input:focus {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          outline-color: transparent !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
        }

        .login-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          background: #1a1a1a !important;
          color: #E2E8F0 !important;
          -webkit-text-fill-color: #E2E8F0 !important;
          border: 1px solid rgba(100, 100, 100, 0.3) !important;
          border-radius: 10px;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .login-input:hover:not(:focus) {
          border-color: rgba(150, 150, 150, 0.4) !important;
        }

        .login-input:focus,
        .login-input:focus-visible {
          border-color: rgba(180, 180, 180, 0.5) !important;
          box-shadow: 0 0 0 1.5px rgba(180, 180, 180, 0.25), 0 0 15px rgba(160, 160, 160, 0.1) !important;
          animation: focus-flash 0.4s ease-out;
        }

        /* Autofill Override - match password box background */
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #E2E8F0 !important;
          caret-color: #E2E8F0;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1a inset !important;
          box-shadow: 0 0 0px 1000px #1a1a1a inset !important;
          background-color: #1a1a1a !important;
          border-color: rgba(180, 180, 180, 0.3) !important;
          transition: background-color 99999s ease-in-out 0s;
        }

        /* CTA Button - PREMIUM ANIMATED with shimmer wave */
        @keyframes btn-shimmer-wave {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes btn-glow-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(200, 200, 200, 0.15), 0 8px 32px rgba(180, 180, 180, 0.08); }
          50% { box-shadow: 0 6px 28px rgba(220, 220, 220, 0.25), 0 12px 40px rgba(200, 200, 200, 0.12); }
        }

        .login-cta {
          margin-top: 16px;
          padding: 16px 24px;
          border-radius: 14px;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          border: none;
          position: relative;
          overflow: hidden;
          /* Premium metallic gradient */
          background: linear-gradient(180deg, 
            #f5f5f5 0%, 
            #e8e8e8 20%, 
            #d4d4d4 50%,
            #c0c0c0 80%,
            #a8a8a8 100%);
          color: #1a1a1a !important;
          -webkit-text-fill-color: #1a1a1a !important;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
          box-shadow: 
            0 4px 20px rgba(200, 200, 200, 0.15),
            0 8px 32px rgba(180, 180, 180, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          animation: btn-glow-pulse 3s ease-in-out infinite;
        }

        /* Shimmer wave overlay */
        .login-cta::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0) 30%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 70%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: btn-shimmer-wave 4s ease-in-out infinite;
          pointer-events: none;
        }

        .login-cta:hover:not([disabled]) {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 
            0 8px 32px rgba(220, 220, 220, 0.3),
            0 16px 48px rgba(180, 180, 180, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
        }

        .login-cta:active:not([disabled]) {
          transform: translateY(0) scale(0.99);
        }

        .login-cta[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
          animation: none;
        }

        .login-cta[disabled]::before {
          animation: none;
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

        /* ===== Forgot Password Styles ===== */
        
        /* Subtle link below password */
        .forgot-link {
          display: block;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          margin: 8px 0 4px;
          text-align: right;
          background: linear-gradient(to right, #6b7280 0%, #94A3B8 50%, #6b7280 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          transition: all 0.2s ease;
        }

        .forgot-link:hover {
          background: linear-gradient(to right, #9ca3af 0%, #e2e8f0 50%, #9ca3af 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        /* Modal overlay with blur */
        .forgot-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: overlay-fade-in 0.2s ease-out;
        }

        @keyframes overlay-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal card */
        .forgot-modal {
          width: 100%;
          max-width: 400px;
          margin: 20px;
          padding: 32px;
          background: #1e1e1e;
          border-radius: 16px;
          border: 1px solid rgba(140, 140, 140, 0.25);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          position: relative;
          animation: modal-slide-in 0.3s ease-out;
        }

        @keyframes modal-slide-in {
          from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Close button */
        .forgot-close {
          position: absolute;
          top: 12px;
          right: 16px;
          background: none;
          border: none;
          font-size: 28px;
          color: #6b7280;
          cursor: pointer;
          line-height: 1;
          transition: color 0.2s;
        }

        .forgot-close:hover {
          color: #e2e8f0;
        }

        /* Modal title */
        .forgot-title {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          background: linear-gradient(to right, #888888 0%, #ffffff 50%, #888888 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }

        .forgot-subtitle {
          margin: 0 0 24px;
          font-size: 14px;
          text-align: center;
          color: #9ca3af;
        }

        /* Modal input */
        .forgot-input {
          margin-bottom: 16px;
        }

        /* Submit button */
        .forgot-submit {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(180deg, #f0f0f0 0%, #d4d4d4 50%, #b8b8b8 100%);
          color: #1a1a1a;
          box-shadow: 0 4px 12px rgba(180, 180, 180, 0.15);
          transition: all 0.2s ease;
        }

        .forgot-submit:hover:not([disabled]) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(200, 200, 200, 0.25);
        }

        .forgot-submit[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .forgot-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        /* Success message */
        .forgot-success {
          margin-top: 16px;
          padding: 14px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 10px;
          color: #22c55e;
          font-size: 14px;
          text-align: center;
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: center;
        }

        .forgot-check {
          font-size: 18px;
          font-weight: bold;
        }

        /* Error message */
        .forgot-error {
          margin-top: 16px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #ef4444;
          font-size: 14px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
