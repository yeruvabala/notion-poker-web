'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
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
          // Hash-token style (signup / magic link / recovery / email change)
          // Map the type if present; default to 'signup' for confirm-email.
          const allowed = ['signup', 'magiclink', 'recovery', 'email_change'] as const;
          const type = (allowed.includes(rawType as any) ? rawType : 'signup') as
            | 'signup' | 'magiclink' | 'recovery' | 'email_change';

          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (error) throw error;
        } else {
          setStatus('No auth code found in the URL. Please open a fresh email link.');
          return;
        }

        // Success → go home
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
