'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const sb = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (!sb) {
      router.replace('/login');
      return;
    }
    try {
      setLoading(true);
      await sb.auth.signOut();
      router.replace('/login');
    } catch (e) {
      // optional: show a toast
      console.error('signOut error', e);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="btn"
      onClick={handleSignOut}
      disabled={loading}
      title="Sign out"
      style={{ position: 'absolute', right: 16, top: 16 }}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
