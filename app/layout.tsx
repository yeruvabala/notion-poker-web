// app/layout.tsx  (ROOT LAYOUT)
import './globals.css';
import AuthSync from '@/components/AuthSync';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Keeps server cookies in sync on any route, including /login */}
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
