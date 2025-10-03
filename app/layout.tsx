// app/layout.tsx
import './globals.css';              // ⬅️ REQUIRED
// (optional) If you added the real-time auth bridge earlier:
// import AuthSync from '@/components/AuthSync';

export const metadata = { title: 'Only Poker' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Put your base page styles on <body> so every route (incl. /login) is styled */}
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* {<AuthSync />} */}
        {children}
      </body>
    </html>
  );
}
