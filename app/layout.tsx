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
        `}} />
        {/* Pass pattern index to React via global variable */}
        <script dangerouslySetInnerHTML={{ __html: `window.__PATTERN_INDEX__=${patternIndex};` }} />
      </head>
      <body className="min-h-screen bg-[#1c1c1c] text-[#E2E8F0] antialiased" style={{ background: BG_COLOR }}>
        {/* Just dark overlay - React will fade in the symbols */}
        <div id="__instant-overlay" />
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
