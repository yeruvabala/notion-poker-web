'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient(); // SupabaseClient | null
  const router = useRouter();

  // Render a friendly message if env vars are missing
  if (!supabase) {
    return (
      <main style={{ padding: 20 }}>
        Missing Supabase env vars. Open <code>/api/env-ok</code> and set
        {' '}<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
      </main>
    );
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // Narrow the type for TypeScript (supabase is definitely not null past render guard)
      const sb = supabase as NonNullable<typeof supabase>;

      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
      }

      router.replace('/');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || 'Auth error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, background: '#f3f4f6' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          maxWidth: '100%',
          display: 'grid',
          gap: 12,
          padding: 18,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,.06)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
          Only Poker — {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            required
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            required
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}
          />
        </label>

        <button
          disabled={loading}
          style={{
            padding: 10,
            borderRadius: 10,
            border: '1px solid #1d4ed8',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        {err && <div style={{ color: '#b91c1c' }}>{err}</div>}

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', padding: 6, justifySelf: 'start' }}
        >
          {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
