import './globals.css';
import AuthSync from '@/components/AuthSync';
import NativeAppDetector from '@/components/NativeAppDetector';
import AppLoadingOverlay from '@/components/AppLoadingOverlay';
import { Inter } from 'next/font/google';
import { generateDarkOverlayCss, generateDarkOverlayHtml } from '@/lib/loadingSymbols';

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
  return (
    <html lang="en" className={inter.variable} style={{ background: '#0a0a0f' }}>
      <head>
        {/* Dark background + scattered symbols CSS (same positions as React) */}
        <style dangerouslySetInnerHTML={{ __html: generateDarkOverlayCss() }} />
      </head>
      <body className="min-h-screen bg-[#0a0a0f] text-[#E2E8F0] antialiased" style={{ background: '#0a0a0f' }}>
        {/* Scattered symbols show INSTANTLY before React loads */}
        <div
          id="__instant-overlay"
          dangerouslySetInnerHTML={{ __html: generateDarkOverlayHtml() }}
        />
        <AppLoadingOverlay />
        <AuthSync />
        <NativeAppDetector />
        {children}
      </body>
    </html>
  );
}
