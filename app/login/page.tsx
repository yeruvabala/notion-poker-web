// app/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
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
    // AuthSync will set server cookies; then go to app
    router.push('/');
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold mb-4">Only Poker — Sign in</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          className="w-full rounded-lg border p-2 mb-3"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          className="w-full rounded-lg border p-2 mb-4"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <button
          className="w-full rounded-lg bg-indigo-600 text-white py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="text-sm mt-3">
          No account? <Link href="/login?signup=1" className="text-indigo-600">Sign up</Link>
        </div>
      </form>
    </div>
  );
}
