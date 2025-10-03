// components/AuthSync.tsx
'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function AuthSync() {
  useEffect(() => {
    const supabase = createBrowserClient();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Send current session to the server so it can set/clear cookies
      await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session }),
      });
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
