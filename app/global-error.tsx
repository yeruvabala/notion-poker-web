'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: 12, borderRadius: 12 }}>
{String(error?.message || error)}
{error?.stack ? '\n\n' + error.stack : ''}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
