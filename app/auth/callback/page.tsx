'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

// Detect if running on iOS
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Detect if running on mobile
function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');
  const [showAppButton, setShowAppButton] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const supabase = createClient();

  // Try to open the iOS app
  const openApp = () => {
    // Custom URL scheme for the app
    const appUrl = 'onlypoker://';

    // For iOS, try to open the app
    if (isIOS()) {
      // Create a hidden iframe to try opening the app
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);

      // Also try window.location as backup
      setTimeout(() => {
        window.location.href = appUrl;
      }, 100);

      // Clean up iframe
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    } else {
      // For other platforms, just try direct navigation
      window.location.href = appUrl;
    }
  };

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session);

      if (event === 'PASSWORD_RECOVERY') {
        setStatus('Verified! Redirecting to set new password...');
        // For password recovery, stay on web
        router.push('/auth/update-password');
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        setAuthComplete(true);

        // Check if on mobile - try to open app
        if (isMobile()) {
          setStatus('Email verified! ✓');

          // Try to open the app automatically
          setTimeout(() => {
            openApp();
          }, 500);

          // Show button after a delay in case auto-open fails
          setTimeout(() => {
            setShowAppButton(true);
            setStatus('Email verified! Open the app to continue.');
          }, 1500);
        } else {
          // Desktop - redirect to web app
          const next = searchParams.get('next') || '/';
          setStatus('Success! Redirecting...');
          router.push(next);
        }
        return;
      }
    });

    // Handle code exchange
    async function handleCodeExchange() {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('Link expired or invalid.');

        if (isMobile()) {
          setShowAppButton(true);
        } else {
          setTimeout(() => router.push('/login?error=' + error), 2000);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('Link expired or invalid. Please try again.');

          if (isMobile()) {
            setShowAppButton(true);
          } else {
            setTimeout(() => router.push('/login'), 2000);
          }
          return;
        }
        // After exchange, onAuthStateChange will fire
      }
    }

    handleCodeExchange();

    return () => subscription.unsubscribe();
  }, [supabase, router, searchParams]);

  return (
    <div className="callback-card">
      <div className={`callback-spinner ${authComplete ? 'success' : ''}`}>
        {authComplete && <span className="check">✓</span>}
      </div>
      <p className="callback-status">{status}</p>

      {showAppButton && (
        <div className="app-buttons">
          <button className="open-app-btn" onClick={openApp}>
            Open Only Poker App
          </button>
          <p className="hint">
            If the app doesn't open, make sure you have Only Poker installed.
          </p>
          {!authComplete && (
            <button
              className="web-link"
              onClick={() => router.push('/login')}
            >
              Continue on web instead
            </button>
          )}
        </div>
      )}
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
          padding: 20px;
        }
        .callback-card {
          text-align: center;
          padding: 40px 32px;
          background: #1e1e1e;
          border-radius: 16px;
          border: 1px solid rgba(140, 140, 140, 0.25);
          max-width: 320px;
          width: 100%;
        }
        .callback-spinner {
          width: 50px;
          height: 50px;
          margin: 0 auto 20px;
          border: 3px solid rgba(180, 180, 180, 0.2);
          border-top-color: #c0c0c0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .callback-spinner.success {
          border-color: #22c55e;
          animation: none;
          background: rgba(34, 197, 94, 0.1);
        }
        .callback-spinner .check {
          color: #22c55e;
          font-size: 24px;
          font-weight: bold;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .callback-status {
          color: #e2e8f0;
          font-size: 16px;
          margin: 0;
          line-height: 1.5;
        }
        .app-buttons {
          margin-top: 24px;
        }
        .open-app-btn {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
          border: 1px solid rgba(180, 180, 180, 0.3);
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .open-app-btn:hover {
          background: linear-gradient(135deg, #3d3d3d 0%, #2a2a2a 100%);
          border-color: rgba(200, 200, 200, 0.4);
        }
        .open-app-btn:active {
          transform: scale(0.98);
        }
        .hint {
          color: #6b7280;
          font-size: 13px;
          margin-top: 16px;
          line-height: 1.4;
        }
        .web-link {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 14px;
          cursor: pointer;
          text-decoration: underline;
          margin-top: 12px;
          padding: 0;
        }
        .web-link:hover {
          color: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
