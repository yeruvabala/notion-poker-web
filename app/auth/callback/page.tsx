'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');
  const supabase = createClient();

  useEffect(() => {
    // Listen for auth state changes - this is the KEY to detecting PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session);

      if (event === 'PASSWORD_RECOVERY') {
        // This is the password reset flow!
        setStatus('Verified! Redirecting to set new password...');
        router.push('/auth/update-password');
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        // Normal sign-in from email confirmation
        const next = searchParams.get('next') || '/';
        setStatus('Success! Redirecting...');
        router.push(next);
        return;
      }
    });

    // Also handle code exchange if there's a code in URL
    async function handleCodeExchange() {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('Link expired or invalid. Redirecting to login...');
        setTimeout(() => router.push('/login?error=' + error), 2000);
        return;
      }

      if (code) {
        // Exchange the code - this will trigger onAuthStateChange with the appropriate event
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('Link expired or invalid. Please try again.');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
        // After exchange, the onAuthStateChange will fire with PASSWORD_RECOVERY or SIGNED_IN
      }
    }

    handleCodeExchange();

    return () => subscription.unsubscribe();
  }, [supabase, router, searchParams]);

  return (
    <div className="callback-card">
      <div className="callback-spinner"></div>
      <p className="callback-status">{status}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="callback-page">
      <Suspense fallback={
        <div className="callback-card">
          <div className="callback-spinner"></div>
          <p className="callback-status">Loading...</p>
        </div>
      }>
        <CallbackContent />
      </Suspense>

      <style jsx global>{`
        .callback-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #1c1c1c 0%, #242428 50%, #1c1c1c 100%);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
        .callback-card {
          text-align: center;
          padding: 40px;
          background: #1e1e1e;
          border-radius: 16px;
          border: 1px solid rgba(140, 140, 140, 0.25);
        }
        .callback-spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 20px;
          border: 3px solid rgba(180, 180, 180, 0.2);
          border-top-color: #c0c0c0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .callback-status {
          color: #9ca3af;
          font-size: 15px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
