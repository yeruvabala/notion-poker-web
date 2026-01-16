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
    async function handleCallback() {
      const code = searchParams.get('code');
      const type = searchParams.get('type');
      const next = searchParams.get('next') || '/';

      // Check for error in URL
      const error = searchParams.get('error');
      if (error) {
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => router.push('/login?error=' + error), 2000);
        return;
      }

      // If there's a code, exchange it
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('Link expired or invalid. Please try again.');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
      }

      // After code exchange (or if already authenticated), check the session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Check if this is a password recovery flow
        if (type === 'recovery') {
          setStatus('Verified! Redirecting to set new password...');
          router.push('/auth/update-password');
          return;
        }

        // Normal login/signup - redirect to next or home
        setStatus('Success! Redirecting...');
        router.push(next);
        return;
      }

      // No session means something went wrong
      setStatus('Please try again.');
      setTimeout(() => router.push('/login'), 2000);
    }

    handleCallback();
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
          background: #1c1c1c;
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
