'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function Page() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace('/login?redirectTo=/');
      } else {
        setReady(true);
      }
    });
    return () => { mounted = false; };
  }, [router, supabase]);

  if (!ready) {
    // small branded skeleton while we check the session
    return <div className="p-6 text-lg font-semibold">Only Poker</div>;
  }

  return (
    <main className="p">
      {/* ⬇️ Paste your full two-column JSX here (the big UI you had before) */}
      {/* Example:
      <div className="wrap">
        <h1 className="title">Only Poker</h1>
        <div className="grid">
          <div className="col">...left column sections...</div>
          <div className="col">...right column sections...</div>
        </div>
      </div>
      */}
    </main>
  );
}
