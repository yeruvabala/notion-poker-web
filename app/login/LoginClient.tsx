'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') || '/';
  const supabase = createBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }
    router.replace(redirectTo);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold">Only Poker — Sign in</h1>

        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          className="mt-1 w-full rounded-xl border p-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          className="mt-1 w-full rounded-xl border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
