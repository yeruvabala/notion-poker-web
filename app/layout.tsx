import './globals.css';
import AuthSync from '@/components/AuthSync';
import NativeAppDetector from '@/components/NativeAppDetector';
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
      <body className="min-h-screen bg-[#1c1c1c] text-[#E2E8F0] antialiased">
        <AuthSync />
        <NativeAppDetector />
        {children}
      </body>
    </html>
  );
}
