'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser'; // already in your repo

type Mode = 'login' | 'signup';

export default function LoginClient() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    setNote(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');               // Home requires session and will redirect if missing
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNote('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        {/* Left brand panel */}
        <div className="brand">
          <div className="brandInner">
            <h1>Only Poker</h1>
          </div>
        </div>

        {/* Right auth panel */}
        <div className="auth">
          <div className="tabs">
            <button
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
              type="button"
            >
              Log in
            </button>
            <button
              className={`tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
              type="button"
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="form">
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <div className="msg err">{error}</div>}
            {note && <div className="msg ok">{note}</div>}

            <button className="btnPrimary" type="submit" disabled={loading}>
              {loading ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        /* Theme tokens (match your dashboard look) */
        :root {
          --bg: #f6f7fb;
          --card: #ffffff;
          --muted: #6b7280;
          --text: #0f172a;
          --line: #e6e8ee;
          --focus: #bfdbfe;
          --shadow: 0 25px 60px rgba(15, 23, 42, 0.08);
          --platinum: #E5E4E2;
        }

        .page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: var(--bg);
          padding: 24px;
        }

        .card {
          width: 100%;
          max-width: 1100px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 28px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        /* Left: gradient brand panel */
        .brand {
          background: radial-gradient(1200px 500px at -20% -30%, #eef2ff, transparent 70%),
                      radial-gradient(1200px 500px at 130% 130%, #eef2ff, transparent 70%),
                      linear-gradient(180deg, #f8fafc, #f1f5f9);
          display: grid;
          place-items: center;
        }
        .brandInner h1 {
          font-size: 44px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: 0.5px;
        }

        /* Right: auth form */
        .auth {
          padding: 40px 36px 42px 36px;
        }
        .tabs {
          display: flex;
          gap: 28px;
          margin-bottom: 22px;
          padding: 0 4px;
        }
        .tab {
          appearance: none;
          background: none;
          border: none;
          font-weight: 800;
          font-size: 18px;
          color: var(--muted);
          cursor: pointer;
          padding: 8px 2px;
          border-bottom: 2px solid transparent;
        }
        .tab.active {
          color: var(--text);
          border-color: var(--text);
        }

        .form {
          display: grid;
          gap: 10px;
        }
        .lbl {
          font-size: 13px;
          color: var(--muted);
          font-weight: 600;
        }
        .input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 12px;
          height: 52px;
          padding: 0 14px;
          font-size: 16px;
          color: var(--text);
        }
        .input:focus {
          outline: 3px solid var(--focus);
          outline-offset: 0;
        }

        .msg {
          margin-top: 4px;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
        }
        .msg.err { background: #fee2e2; color: #991b1b; }
        .msg.ok  { background: #ecfdf5; color: #065f46; }

        /* Primary button (hover = black bg + platinum text) */
        .btnPrimary {
          margin-top: 8px;
          height: 54px;
          border-radius: 14px;
          width: 100%;
          background: #eef2ff;
          border: 1px solid #d7defe;
          color: var(--text);             /* default label color = black */
          font-weight: 800;
          letter-spacing: 0.2px;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, border-color .18s ease, transform .06s ease;
        }
        .btnPrimary:hover {
          background: #000000;            /* <- black */
          color: var(--platinum);         /* <- platinum */
          border-color: #000000;
        }
        .btnPrimary:active { transform: translateY(0.5px); }
        .btnPrimary[disabled] {
          opacity: .7;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .card {
            grid-template-columns: 1fr;
          }
          .brand { display: none; }
          .auth { padding: 28px 20px 30px 20px; }
        }
      `}</style>
    </main>
  );
}
