'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState('Processing your password reset...');
    const supabase = createClient();

    useEffect(() => {
        async function handleReset() {
            // The code is in the URL hash or query params after Supabase redirect
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const queryParams = new URLSearchParams(window.location.search);

            // Check for error first
            const error = hashParams.get('error') || queryParams.get('error');
            if (error) {
                setStatus('Reset link expired or invalid. Please request a new one.');
                setTimeout(() => router.push('/login'), 3000);
                return;
            }

            // Try to get the session - if code exchange already happened via Supabase's auto-handling
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (session) {
                // User has a valid session, redirect to update password
                setStatus('Verified! Redirecting to set new password...');
                router.push('/auth/update-password');
                return;
            }

            // If no session yet, there might be a code to exchange
            const code = queryParams.get('code');
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (!exchangeError) {
                    setStatus('Verified! Redirecting to set new password...');
                    router.push('/auth/update-password');
                    return;
                }
            }

            // No session and no code means something went wrong
            setStatus('Unable to verify. Please try again.');
            setTimeout(() => router.push('/login'), 3000);
        }

        handleReset();
    }, [supabase, router]);

    return (
        <div className="reset-callback-page">
            <div className="reset-callback-card">
                <div className="reset-spinner"></div>
                <p className="reset-status">{status}</p>
            </div>

            <style jsx>{`
        .reset-callback-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: #1c1c1c;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
        .reset-callback-card {
          text-align: center;
          padding: 40px;
          background: #1e1e1e;
          border-radius: 16px;
          border: 1px solid rgba(140, 140, 140, 0.25);
        }
        .reset-spinner {
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
        .reset-status {
          color: #9ca3af;
          font-size: 15px;
          margin: 0;
        }
      `}</style>
        </div>
    );
}
