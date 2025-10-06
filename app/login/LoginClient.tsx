'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

type Mode = 'login' | 'signup';

export default function LoginClient() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
      }
      router.replace('/');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap">
      <div className="card">
        {/* Left brand side */}
        <div className="brandPanel">
          <h1 className="brandTitle">Only Poker</h1>
          <p className="brandSub">v0.1 · preview</p>
        </div>

        {/* Right form side */}
        <div className="formPanel">
          <div className="tabs">
            <button
              className={`tab ${mode === 'login' ? 'tabActive' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              className={`tab ${mode === 'signup' ? 'tabActive' : ''}`}
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="form">
            <label className="lbl">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="lbl">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />

            {err && <div className="error">{err}</div>}

            <button className="cta" type="submit" disabled={loading}>
              {loading
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating…'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            </button>
          </form>
        </div>
      </div>

      {/* ===== Styles ===== */}
      <style jsx>{`
        :root {
          --bg:#f5f7fb;
          --card:#ffffff;
          --ink:#0f172a;
          --muted:#6b7280;
          --line:#e5e7eb;
          --platinum:#E5E4E2; /* hover label */
          --black:#0a0a0a;    /* button background */
        }
        .wrap {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: radial-gradient(1200px 700px at 60% -10%, #eef2ff 0%, #f8fafc 40%, var(--bg) 80%);
          padding: 32px;
        }
        .card {
          width: min(1050px, 92vw);
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          background: var(--card);
          border-radius: 24px;
          box-shadow:
            0 20px 60px rgba(15,23,42,.10),
            0 6px 16px rgba(15,23,42,.06);
          overflow: hidden;
          border: 1px solid var(--line);
        }
        @media (max-width: 900px) {
          .card { grid-template-columns: 1fr; }
        }

        /* Left */
        .brandPanel {
          padding: clamp(28px, 6vw, 56px);
          background: radial-gradient(900px 600px at -30% -30%, #eef2ff 0%, #f5f7ff 40%, #ffffff 75%);
          display: grid;
          align-content: center;
        }
        .brandTitle {
          margin: 0 0 8px 0;
          /* smaller & lighter headline */
          font-size: clamp(28px, 4.0vw, 44px);
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .brandSub {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }

        /* Right */
        .formPanel {
          padding: clamp(28px, 6vw, 56px);
          display: grid;
          align-content: center;
          gap: 18px;
        }
        .tabs {
          display: flex;
          gap: 18px;
          margin-bottom: 6px;
        }
        .tab {
          background: transparent;
          border: none;
          padding: 0;
          font-weight: 600;
          color: #1f2937;
          cursor: pointer;
          position: relative;
          font-size: 18px;
        }
        .tab::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: -10px;
          height: 2px;
          background: transparent;
          transition: background .2s ease;
        }
        .tabActive { color: var(--ink); }
        .tabActive::after { background: #111827; }

        .form {
          margin-top: 8px;
          display: grid;
          gap: 10px;
        }
        .lbl {
          font-size: 13px;
          color: #374151;
          font-weight: 600;
        }
        .input {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }
        .input:focus {
          border-color: #bfd2ff;
          box-shadow: 0 0 0 4px rgba(191,210,255,.35);
        }

        .error {
          margin-top: 4px;
          color: #b91c1c;
          font-size: 13px;
        }

        /* Black button / platinum label on hover */
        .cta {
          margin-top: 6px;
          border: 1px solid #111;
          background: var(--black);
          color: #E5E7EB;
          padding: 14px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: color .18s ease, transform .02s ease-in-out, box-shadow .18s ease;
          box-shadow: 0 2px 0 #000;
        }
        .cta:hover {
          color: var(--platinum); /* text turns platinum */
          transform: translateY(-0.5px);
          box-shadow: 0 3px 0 #000;
        }
        .cta:active { transform: translateY(0.5px); box-shadow: 0 1px 0 #000; }
        .cta[disabled] { opacity: .6; cursor: not-allowed; }
      `}</style>
    </main>
  );
}
