'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // Env guard (helps on first deploys)
  if (!supabase) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        Missing Supabase env vars. See <code>/api/env-ok</code>.
      </main>
    );
  }
  // Narrow once so TS stops complaining about possibly null
  const sb = supabase as NonNullable<typeof supabase>;

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If already signed in, bounce to home
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        router.replace('/');
        router.refresh();
      }
    })();
  }, [router, sb]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
        router.refresh();
      } else {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: {
            // 👇 important: where Supabase will send users after clicking the email link
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setInfo('Check your email for a confirmation link to finish signing up.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginWrap">
      <form className="card" onSubmit={onSubmit}>
        <h1 className="title">Only Poker — {mode === 'signin' ? 'Sign in' : 'Sign up'}</h1>

        <label className="lbl">Email</label>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <label className="lbl">Password</label>
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? (mode === 'signin' ? 'Signing in…' : 'Signing up…') : (mode === 'signin' ? 'Sign in' : 'Sign up')}
        </button>

        <div className="muted small" style={{ marginTop: 12 }}>
          {mode === 'signin' ? (
            <>No account?{' '}
              <button type="button" className="link" onClick={() => setMode('signup')}>Sign up</button>
            </>
          ) : (
            <>Have an account?{' '}
              <button type="button" className="link" onClick={() => setMode('signin')}>Sign in</button>
            </>
          )}
        </div>

        {err && <div className="err">{err}</div>}
        {info && <div className="note">{info}</div>}
      </form>

      <style jsx global>{`
        .loginWrap{min-height:100dvh;display:grid;place-items:center;background:#f3f4f6}
        .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 24px;box-shadow:0 8px 24px rgba(0,0,0,.06);width:100%;max-width:540px;display:flex;flex-direction:column;gap:10px}
        .title{margin:0 0 6px;font-size:26px;font-weight:800}
        .lbl{font-size:12px;color:#6b7280}
        .input{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px}
        .btn{border:1px solid #e5e7eb;background:#fff;padding:10px 14px;border-radius:12px;cursor:pointer}
        .btn.primary{background:linear-gradient(180deg,#2563eb,#1d4ed8);color:#f8fbff;border-color:#9db7ff;margin-top:8px}
        .btn[disabled]{opacity:.6;cursor:not-allowed}
        .muted{color:#6b7280}
        .small{font-size:12px}
        .link{background:none;border:none;padding:0;margin:0;color:#2563eb;cursor:pointer}
        .err{margin-top:8px;color:#b91c1c}
        .note{margin-top:8px;color:#166534}
      `}</style>
    </main>
  );
}
