import './globals.css';
import AuthSync from '@/components/AuthSync';

export const metadata = { title: 'Only Poker' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
