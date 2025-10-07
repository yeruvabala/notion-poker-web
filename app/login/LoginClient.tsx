'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/browser'; // your helper that always returns a client

type Tab = 'login' | 'signup';

export default function LoginClient() {
  const supabase = createBrowserClient();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Keep server cookies in sync if a token refresh/sign-in happens
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        try {
          await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, session }),
          });
        } catch {
          /* non-fatal; UI still works */
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);

    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your inbox for verification.');
      }
    } catch (err: any) {
      setMsg(err?.message ?? 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="box">
      <nav className="tabs">
        <button
          className={tab === 'login' ? 'tab active' : 'tab'}
          onClick={() => setTab('login')}
          type="button"
        >
          Log in
        </button>
        <button
          className={tab === 'signup' ? 'tab active' : 'tab'}
          onClick={() => setTab('signup')}
          type="button"
        >
          Create account
        </button>
      </nav>

      <form onSubmit={handleSubmit} className="form">
        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="field"
          autoComplete="email"
        />

        <label>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="field"
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        />

        {msg && <p className="msg">{msg}</p>}

        <button className="cta" disabled={pending}>
          {tab === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="tiny">
        Forgot your password?&nbsp;
        <Link href="https://supabase.com/docs/guides/auth" target="_blank">
          Reset
        </Link>
      </p>

      <style jsx>{`
        .box { display: grid; gap: 14px; }

        .tabs { display: flex; gap: 20px; margin-bottom: 6px; }
        .tab {
          appearance: none;
          background: transparent;
          border: 0;
          padding: 0 0 8px;
          font-weight: 700;
          color: #111827;
          cursor: pointer;
          position: relative;
        }
        .tab.active::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 3px;
          background: #111827; /* black underline */
          border-radius: 2px;
        }

        .form {
          display: grid;
          gap: 10px;
          margin-top: 4px;
        }

        label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
        }

        .field {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(2,6,23,0.08);
          background: #f6f7f9;
          padding: 14px 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: box-shadow .15s ease, border-color .15s ease, background .15s ease;
        }
        .field:focus {
          background: #ffffff;
          border-color: rgba(2,6,23,0.15);
          box-shadow: 0 0 0 6px rgba(2,6,23,0.05);
        }

        .msg {
          margin: 4px 0 2px;
          font-size: 13px;
          color: #0f172a;
        }

        /* Black & white button: outline by default, fills black on hover */
        .cta {
          margin-top: 8px;
          border-radius: 12px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          border: 1px solid #0f172a;
          background: #ffffff;
          color: #0f172a;
          transition: background .18s ease, color .18s ease, transform .02s ease-in-out;
        }
        .cta:not(:disabled):hover {
          background: #0a0a0a;
          color: #f1f5f9; /* platinum-ish */
          transform: translateY(-0.5px);
        }
        .cta:disabled {
          opacity: .7;
          cursor: not-allowed;
        }

        .tiny {
          margin: 6px 0 0;
          font-size: 12px;
          color: #6b7280;
        }
        .tiny :global(a) { color: #111827; font-weight: 600; }
      `}</style>
    </div>
  );
}
