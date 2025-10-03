// components/AuthSync.tsx
'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function AuthSync() {
  useEffect(() => {
    const supabase = createBrowserClient();

    // On first load, send current session to the server
    supabase.auth.getSession().then(({ data }) => {
      fetch('/auth/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'INITIAL', session: data.session }),
      }).catch(() => {});
    });

    // Keep server cookies up-to-date for sign-in, sign-out, refresh
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      fetch('/auth/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event, session }),
      }).catch(() => {});
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
