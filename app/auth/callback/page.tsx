'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  if (!supabase) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        Missing Supabase env vars. See <code>/api/env-ok</code>.
      </main>
    );
  }
  const sb = supabase as NonNullable<typeof supabase>;

  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    (async () => {
      try {
        // Exchange the code in the email link for a session
        const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        setMessage('Signed in! Redirecting…');
        router.replace('/');
        router.refresh();
      } catch (e: any) {
        setMessage(e?.message || 'Unable to complete sign-in. Try the link again or sign in manually.');
      }
    })();
  }, [router, sb]);

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
        {message}
      </div>
    </main>
  );
}
