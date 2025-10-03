// app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';
import AuthSync from '@/components/AuthSync';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Keeps server cookies in sync with client session (works on /login too) */}
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
