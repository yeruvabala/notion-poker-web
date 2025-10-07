// app/login/LoginClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // your browser @supabase/ssr helper

export default function LoginClient() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Optional: if tokens refresh, keep the server cookie in sync
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        try {
          await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, session }),
            keepalive: true,
          });
        } catch {
          /* ignore */
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // IMPORTANT: write cookie before navigating
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
        });

        router.replace('/'); // now the server sees the cookie
      } else {
        // sign up (email+password)
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your email for verification.');
      }
    } catch (err: any) {
      setMsg(err?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-[0_20px_80px_rgba(2,6,23,0.08)] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* left brand panel */}
        <div className="hidden md:flex items-end p-10 bg-gradient-to-b from-stone-50 to-stone-100">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Only Poker</h1>
            <p className="mt-2 text-sm text-slate-500">v0.1 · preview</p>
          </div>
        </div>

        {/* form */}
        <div className="p-8 md:p-10">
          <div className="mb-6 flex items-center gap-6">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`text-sm font-semibold ${
                tab === 'login' ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Log in
              {tab === 'login' && <span className="block h-[2px] bg-black mt-2" />}
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`text-sm font-semibold ${
                tab === 'signup' ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Create account
              {tab === 'signup' && <span className="block h-[2px] bg-black mt-2" />}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-300"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">Password</label>
              <input
                type="password"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-300"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            </div>

            {msg && <p className="text-sm text-slate-600">{msg}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border border-black bg-white text-slate-900 font-semibold py-3 shadow-[0_2px_0_#000] transition hover:bg-black hover:text-white disabled:opacity-60"
            >
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
