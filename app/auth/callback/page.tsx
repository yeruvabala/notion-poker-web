'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Avoid static prerender of this page – it relies on search params at runtime.
export const dynamic = 'force-dynamic';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus('Missing Supabase env vars (see /api/env-ok).');
        return;
      }

      try {
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const rawType = (params.get('type') || '').toLowerCase();

        if (code) {
          // PKCE / one-time code flow
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          // Hash-token style (signup / magiclink / recovery / email change)
          const allowed = ['signup', 'magiclink', 'recovery', 'email_change'] as const;
          const type = (allowed.includes(rawType as any) ? rawType : 'signup') as
            | 'signup' | 'magiclink' | 'recovery' | 'email_change';

          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (error) throw error;
        } else {
          setStatus('No auth code found in the URL. Please open a fresh email link.');
          return;
        }

        setStatus('Signed in! Redirecting…');
        router.replace('/');
      } catch (err: any) {
        setStatus(err?.message || 'Authentication failed.');
      }
    })();
  }, [params, router, supabase]);

  return (
    <main className="p">
      <div className="wrap">{status}</div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p">
          <div className="wrap">Completing sign-in…</div>
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
