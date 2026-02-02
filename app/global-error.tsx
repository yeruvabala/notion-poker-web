'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global Error Handler - Shows blank dark page on errors
 * Errors are automatically sent to Sentry for debugging
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{
        background: '#1c1c1c',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Something went wrong</p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
