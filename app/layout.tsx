// app/layout.tsx
import './globals.css';
import AuthSync from '@/components/AuthSync';

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
