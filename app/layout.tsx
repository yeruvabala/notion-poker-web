// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Only Poker',
  description: 'Poker study & hand tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <div className="flex">
          {/* Left rail (hidden on mobile) */}
          <Sidebar />

          {/* Right content area */}
          <main className="min-h-screen flex-1">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
