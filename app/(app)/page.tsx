'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function Page() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [router, supabase]);

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="text-slate-500">Loading…</div>
      </main>
    );
  }

  // ===== Your current two-column UI EXACTLY as-is below this line =====
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Only Poker</h1>
      {/* your existing two-column grid/content here */}
    </main>
  );
}
