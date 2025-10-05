'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function AuthSync() {
  useEffect(() => {
    const supabase = createBrowserClient();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      } catch {
        // best effort; ignore
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  return null;
}
