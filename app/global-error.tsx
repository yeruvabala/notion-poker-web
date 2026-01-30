'use client';

/**
 * Global Error Handler - Shows blank dark page on errors
 * No error details exposed to users for security
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{
        background: '#1c1c1c',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        width: '100vw',
      }}>
        {/* Intentionally blank - no error details shown to users */}
      </body>
    </html>
  );
}
