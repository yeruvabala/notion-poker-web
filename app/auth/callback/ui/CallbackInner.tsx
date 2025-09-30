'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = params.get('code');
    const supabase = createClient();

    (async () => {
      if (!code) {
        router.replace('/login?error=missing_code');
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      router.replace(error ? '/login?error=auth' : '/');
    })();
  }, [params, router]);

  return <p>Completing sign-in…</p>;
}
