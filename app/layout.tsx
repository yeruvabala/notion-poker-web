import './globals.css';
import AuthSync from '@/components/AuthSync';
import NativeAppDetector from '@/components/NativeAppDetector';
import AppLoadingOverlay from '@/components/AppLoadingOverlay';
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
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Pick a random pattern (0-16) on each page load
  const patternIndex = Math.floor(Math.random() * SCATTER_PATTERNS.length);

  return (
    <html lang="en" className={inter.variable} style={{ background: '#0a0a0f' }}>
      <head>
        {/* Dark background CSS - no symbols, React will fade them in */}
        <style dangerouslySetInnerHTML={{
          __html: `
          html, body { background: #0a0a0f !important; }
          #__instant-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 999998;
            background: #0a0a0f;
          }
        `}} />
        {/* Pass pattern index to React via global variable */}
        <script dangerouslySetInnerHTML={{ __html: `window.__PATTERN_INDEX__=${patternIndex};` }} />
      </head>
      <body className="min-h-screen bg-[#0a0a0f] text-[#E2E8F0] antialiased" style={{ background: '#0a0a0f' }}>
        {/* Just dark overlay - React will fade in the symbols */}
        <div id="__instant-overlay" />
        <AppLoadingOverlay />
        <AuthSync />
        <NativeAppDetector />
        {children}
      </body>
    </html>
  );
}
