// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // AuthSync will set server cookies via /auth/callback; then refresh and go home
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Only Poker — Sign in</h1>

        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          className="mt-1 mb-4 w-full rounded-lg border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          className="mt-1 mb-4 w-full rounded-lg border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-white disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {/* optional: link to sign up route if you have one */}
        {/* <p className="mt-3 text-sm text-slate-600">
          No account? <a href="/signup" className="text-indigo-600 underline">Sign up</a>
        </p> */}
      </form>
    </div>
  );
}
