import './globals.css';
import AuthSync from '@/components/AuthSync';
import NativeAppDetector from '@/components/NativeAppDetector';
import AppLoadingOverlay from '@/components/AppLoadingOverlay';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { Inter } from 'next/font/google';
import { SCATTER_PATTERNS } from '@/lib/loadingSymbols';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Only Poker',
  icons: {
    icon: '/static/favicon.png',
    shortcut: '/static/favicon.png',
    apple: '/static/favicon.png',
  },
};

// Next.js 14+ requires viewport as a separate export
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// Unified background color - matches home page
const BG_COLOR = '#1c1c1c';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Pick a random pattern (0-16) on each page load
  const patternIndex = Math.floor(Math.random() * SCATTER_PATTERNS.length);

  return (
    <html lang="en" className={inter.variable} style={{ background: BG_COLOR }}>
      <head>
        {/* Dark background CSS - matches home page */}
        <style dangerouslySetInnerHTML={{
          __html: `
          html, body { background: ${BG_COLOR} !important; }
          #__instant-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 999998;
            background: ${BG_COLOR};
          }
          /* Pure CSS fallback - shows after 10s if JS doesn't load */
          #__js-failed-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 999997;
            background: ${BG_COLOR};
            color: #f59e0b;
            padding: 60px 20px 20px 20px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            opacity: 0;
            animation: showDebug 0.5s ease-out 10s forwards;
            overflow-y: auto;
          }
          @keyframes showDebug {
            to { opacity: 1; }
          }
          /* Hide this overlay when JS signals it's loaded */
          #__js-failed-overlay.hidden { display: none !important; }
          #__js-failed-overlay h1 { font-size: 18px; margin-bottom: 12px; }
          #__js-failed-overlay p { font-size: 13px; color: #9ca3af; margin-bottom: 16px; line-height: 1.5; }
          #__js-failed-overlay .debug-box { background: #2a2a2a; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
          #__js-failed-overlay code { font-size: 11px; color: #3b82f6; }
        `}} />
        {/* Pass pattern index to React via global variable */}
        <script dangerouslySetInnerHTML={{ __html: `window.__PATTERN_INDEX__=${patternIndex};` }} />
      </head>
      <body className="min-h-screen bg-[#1c1c1c] text-[#E2E8F0] antialiased" style={{ background: BG_COLOR }}>
        {/* Just dark overlay - React will fade in the symbols */}
        <div id="__instant-overlay" />

        {/* Pure HTML fallback - shows if JavaScript doesn't execute */}
        <div id="__js-failed-overlay">
          <h1>⚠️ App Not Loading</h1>
          <p>
            JavaScript didn&apos;t execute within 10 seconds. This usually means:
          </p>
          <div className="debug-box">
            <p style={{ margin: 0, color: '#9ca3af' }}>
              • Poor network connection<br />
              • Server at onlypoker.ai is unreachable<br />
              • JavaScript bundle failed to download<br />
              • Certificate or SSL issue
            </p>
          </div>
          <div className="debug-box">
            <p style={{ margin: 0, marginBottom: 8, color: '#f59e0b' }}>Try these steps:</p>
            <p style={{ margin: 0, color: '#9ca3af' }}>
              1. Check your internet connection<br />
              2. Close and reopen the app<br />
              3. Try visiting onlypoker.ai in Safari first
            </p>
          </div>
          <div className="debug-box">
            <code>Timestamp: {new Date().toISOString()}</code>
          </div>
        </div>

        <AppLoadingOverlay />
        <AuthSync />
        <NativeAppDetector />
        <AppErrorBoundary>
          {children}
        </AppErrorBoundary>
      </body>
    </html>
  );
}
