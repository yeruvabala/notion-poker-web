'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const qp = useSearchParams();
  const signupMode = qp.get('signup') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const res = signupMode
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    // Session is available on the client immediately — go to app.
    router.replace('/');
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold">
          Only Poker — {signupMode ? 'Sign up' : 'Sign in'}
        </h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              className="w-full rounded-lg border p-2"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              className="w-full rounded-lg border p-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signupMode ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? (signupMode ? 'Creating…' : 'Signing in…') : (signupMode ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <div className="mt-3 text-sm text-slate-600">
          {signupMode ? (
            <>Have an account?{' '}
              <a href="/login" className="text-indigo-600 hover:underline">Sign in</a>
            </>
          ) : (
            <>No account?{' '}
              <a href="/login?signup=1" className="text-indigo-600 hover:underline">Sign up</a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
