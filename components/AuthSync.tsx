'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createBrowserClient();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthSync: Auth event detected:', event);

      // Handle PASSWORD_RECOVERY event - redirect to update password page
      if (event === 'PASSWORD_RECOVERY') {
        console.log('AuthSync: PASSWORD_RECOVERY detected! Redirecting to update-password...');
        router.push('/auth/update-password');
        return;
      }

      // Sync session with server for other events
      try {
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        }).catch(() => {
          // Fallback to old endpoint if new one doesn't exist
          return fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, session }),
          });
        });
      } catch {
        // best effort; ignore
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
