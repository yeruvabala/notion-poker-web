import './globals.css';
import AuthSync from '@/components/AuthSync';

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
    <html lang="en">
      <body className="min-h-screen bg-[#1c1c1c] text-[#E2E8F0] antialiased">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
