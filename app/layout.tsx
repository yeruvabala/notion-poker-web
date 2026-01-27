import './globals.css';
import AuthSync from '@/components/AuthSync';
import NativeAppDetector from '@/components/NativeAppDetector';
import AppLoadingOverlay from '@/components/AppLoadingOverlay';
import { Inter } from 'next/font/google';

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
    <html lang="en" className={inter.variable}>
      <head>
        {/* CRITICAL: Immediate blocking overlay before JS loads */}
        <style dangerouslySetInnerHTML={{
          __html: `
            #__instant-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              z-index: 999998;
              background: #0a0a0f;
            }
          `
        }} />
      </head>
      <body className="min-h-screen bg-[#0a0a0f] text-[#E2E8F0] antialiased">
        {/* This div shows INSTANTLY before React hydrates */}
        <div id="__instant-overlay" />
        <AppLoadingOverlay />
        <AuthSync />
        <NativeAppDetector />
        {children}
      </body>
    </html>
  );
}
