'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      if (!supabase) return;

      // Handles both `?code=` and `#access_token=` styles
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      // Optional: you can check `error?.message` and show a nicer UI
      router.replace('/');
      router.refresh();
    })();
  }, [router, supabase]);

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      Finishing sign in…
    </main>
  );
}
