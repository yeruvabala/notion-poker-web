// components/AuthSync.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser'; // your browser client

export default function AuthSync() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Tell the server to set/clear cookies to match the client session
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });

        // re-run server components so the layouts see the new session
        router.refresh();
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return null;
}
