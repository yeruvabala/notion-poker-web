// app/layout.tsx
import './globals.css';
import AuthSync from '@/components/AuthSync';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Keeps Supabase cookies in sync on the client for ALL routes, incl. /login */}
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
