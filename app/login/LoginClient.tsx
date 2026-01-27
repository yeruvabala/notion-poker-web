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
        await fetch('/api/auth/sync', {
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
      await fetch('/api/auth/sync', {
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
      {/* Animated Floating Card Suits - Positioned at edges */}
      <div className="login-floating-bg">
        {/* Top row */}
        <span className="floating-suit s1">♠</span>
        <span className="floating-suit s2">♥</span>
        <span className="floating-suit s3">♦</span>
        <span className="floating-suit s4">♣</span>
        {/* Bottom row */}
        <span className="floating-suit s5">♠</span>
        <span className="floating-suit s6">♥</span>
        <span className="floating-suit s7">♦</span>
        <span className="floating-suit s8">♣</span>
        {/* Card letters at corners */}
        <span className="floating-suit s9">A</span>
        <span className="floating-suit s10">K</span>
        <span className="floating-suit s11">Q</span>
        <span className="floating-suit s12">J</span>
      </div>

      {/* Ambient glow effects */}
      <div className="login-ambient-glow glow-1"></div>
      <div className="login-ambient-glow glow-2"></div>

      {/* Content - No Card, Just Clean Floating Layout */}
      <div className="login-content">
        {/* Logo with glow effect */}
        <div className="login-logo-container">
          <h1 className="login-title platinum-text-gradient">Only Poker</h1>

          {/* Card Suits with decorative lines */}
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
        </div>

        {/* Tab Switcher */}
        <div className="login-tabs">
          <div className="login-tab-container">
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
            <div className={`login-tab-indicator ${tab === 'signup' ? 'right' : 'left'}`}></div>
          </div>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="login-label">Email</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 6L12 13 2 6" />
              </svg>
              <input
                className="login-input input-ony"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-label">Password</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <input
                className="login-input input-ony"
                type="password"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Forgot password link */}
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
            <span className="login-cta-text">
              {loading ? (tab === 'login' ? 'Signing in…' : 'Creating…') : tab === 'login' ? 'Sign in' : 'Create account'}
            </span>
            <span className="login-cta-arrow">→</span>
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
        /* Page Background - Premium Dark with depth */
        .login-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px;
          background: linear-gradient(180deg, #1c1c1c 0%, #242428 50%, #1c1c1c 100%) !important;
          position: relative;
          overflow: hidden;
        }

        /* Subtle background grid pattern */
        .login-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: 0;
        }

        /* ===== FLOATING CARD SUITS BACKGROUND ===== */
        .login-floating-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes float-drift {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.08; }
          25% { transform: translateY(-20px) rotate(5deg); opacity: 0.15; }
          50% { transform: translateY(-10px) rotate(-3deg); opacity: 0.12; }
          75% { transform: translateY(-25px) rotate(8deg); opacity: 0.1; }
        }

        @keyframes float-drift-slow {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.06; }
          50% { transform: translateY(-30px) rotate(-5deg) scale(1.05); opacity: 0.1; }
        }

        .floating-suit {
          position: absolute;
          font-size: 3rem;
          color: rgba(200, 200, 200, 0.15);
          font-family: serif;
          animation: float-drift 8s ease-in-out infinite;
          filter: blur(0.5px);
        }

        /* TOP ROW - Visible above content */
        .floating-suit.s1 { top: 3%; left: 10%; font-size: 2.5rem; color: rgba(180,180,180,0.2); animation-delay: 0s; }
        .floating-suit.s2 { top: 5%; right: 15%; font-size: 2.2rem; color: rgba(239,68,68,0.2); animation-delay: 0.5s; }
        .floating-suit.s3 { top: 8%; left: 50%; font-size: 1.8rem; color: rgba(239,68,68,0.18); animation-delay: 1s; }
        .floating-suit.s4 { top: 2%; right: 35%; font-size: 2rem; color: rgba(180,180,180,0.15); animation-delay: 1.5s; }
        
        /* BOTTOM ROW - Visible below content */
        .floating-suit.s5 { bottom: 8%; left: 12%; font-size: 2.2rem; color: rgba(180,180,180,0.18); animation: float-drift-slow 10s ease-in-out infinite; }
        .floating-suit.s6 { bottom: 5%; right: 10%; font-size: 2rem; color: rgba(239,68,68,0.2); animation: float-drift-slow 12s ease-in-out infinite; animation-delay: 2s; }
        .floating-suit.s7 { bottom: 10%; left: 40%; font-size: 1.8rem; color: rgba(239,68,68,0.15); animation-delay: 3s; }
        .floating-suit.s8 { bottom: 3%; right: 40%; font-size: 2.5rem; color: rgba(180,180,180,0.18); animation-delay: 4s; }
        
        /* Card rank letters - CORNERS */
        .floating-suit.s9 { top: 12%; left: 5%; font-size: 3.5rem; color: rgba(200,200,200,0.08); animation: float-drift-slow 15s ease-in-out infinite; font-weight: 700; }
        .floating-suit.s10 { top: 10%; right: 5%; font-size: 3rem; color: rgba(200,200,200,0.06); animation: float-drift-slow 18s ease-in-out infinite; animation-delay: 5s; font-weight: 700; }
        .floating-suit.s11 { bottom: 15%; left: 3%; font-size: 2.8rem; color: rgba(200,200,200,0.07); animation: float-drift-slow 14s ease-in-out infinite; animation-delay: 8s; font-weight: 700; }
        .floating-suit.s12 { bottom: 12%; right: 8%; font-size: 3.2rem; color: rgba(200,200,200,0.06); animation: float-drift-slow 16s ease-in-out infinite; animation-delay: 3s; font-weight: 700; }

        /* ===== AMBIENT GLOW EFFECTS ===== */
        .login-ambient-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        .glow-1 {
          width: 300px;
          height: 300px;
          top: 5%;
          left: -10%;
          background: radial-gradient(circle, rgba(100,100,120,0.4) 0%, transparent 70%);
          animation: glow-pulse 8s ease-in-out infinite;
        }

        .glow-2 {
          width: 250px;
          height: 250px;
          bottom: 5%;
          right: -5%;
          background: radial-gradient(circle, rgba(80,80,100,0.35) 0%, transparent 70%);
          animation: glow-pulse 10s ease-in-out infinite;
          animation-delay: 4s;
        }

        /* Override global body for login */
        html, body {
          margin: 0;
          background: #0a0a0f !important;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }

        /* ===== CLEAN CONTENT LAYOUT (No Card) ===== */
        .login-content {
          width: 100%;
          max-width: 340px;
          padding: 0 20px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Logo container with optional glow */
        .login-logo-container {
          text-align: center;
          margin-bottom: 32px;
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

        /* Tab Switcher - Premium with animated indicator */
        .login-tabs {
          margin-bottom: 28px;
        }

        .login-tab-container {
          display: flex;
          position: relative;
          justify-content: center;
          gap: 32px;
          padding-bottom: 10px;
        }

        .login-tab {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.3s ease;
          color: rgba(150, 150, 160, 0.7) !important;
          -webkit-text-fill-color: rgba(150, 150, 160, 0.7) !important;
        }

        .login-tab:hover {
          color: rgba(200, 200, 210, 0.9) !important;
          -webkit-text-fill-color: rgba(200, 200, 210, 0.9) !important;
        }

        .login-tab.active {
          color: rgba(255, 255, 255, 0.95) !important;
          -webkit-text-fill-color: rgba(255, 255, 255, 0.95) !important;
        }

        /* Animated sliding indicator */
        .login-tab-indicator {
          position: absolute;
          bottom: 0;
          height: 2px;
          width: 60px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
          border-radius: 2px;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .login-tab-indicator.left {
          left: calc(50% - 95px);
        }

        .login-tab-indicator.right {
          left: calc(50% + 35px);
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Input Groups */
        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .login-input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(15, 15, 20, 0.6);
          border: 1px solid rgba(100, 100, 110, 0.25);
          border-radius: 12px;
          padding: 0 16px;
          transition: all 0.3s ease;
        }

        .login-input-wrapper:hover {
          border-color: rgba(150, 150, 160, 0.35);
          background: rgba(20, 20, 25, 0.7);
        }

        .login-input-wrapper:focus-within {
          border-color: rgba(180, 180, 190, 0.4);
          background: rgba(20, 20, 25, 0.85);
          box-shadow: 
            0 0 0 3px rgba(255, 255, 255, 0.05),
            0 0 20px rgba(150, 150, 160, 0.1);
        }

        .login-input-icon {
          flex-shrink: 0;
          color: rgba(150, 150, 160, 0.5);
          transition: color 0.3s ease;
        }

        .login-input-wrapper:focus-within .login-input-icon {
          color: rgba(200, 200, 210, 0.8);
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
          flex: 1;
          padding: 14px 0;
          font-size: 15px;
          background: transparent !important;
          color: #E2E8F0 !important;
          -webkit-text-fill-color: #E2E8F0 !important;
          border: none !important;
        }

        .login-input::placeholder {
          color: rgba(150, 150, 160, 0.5);
        }

        /* Autofill Override */
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #E2E8F0 !important;
          caret-color: #E2E8F0;
          -webkit-box-shadow: 0 0 0px 1000px rgba(15, 15, 20, 0.9) inset !important;
          box-shadow: 0 0 0px 1000px rgba(15, 15, 20, 0.9) inset !important;
          background-color: transparent !important;
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

        /* Button content layout */
        .login-cta-text {
          position: relative;
          z-index: 1;
        }

        .login-cta-arrow {
          position: relative;
          z-index: 1;
          margin-left: 8px;
          font-size: 18px;
          transition: transform 0.3s ease;
        }

        .login-cta:hover:not([disabled]) .login-cta-arrow {
          transform: translateX(4px);
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
