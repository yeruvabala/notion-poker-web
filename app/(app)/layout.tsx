// app/(app)/layout.tsx
import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Two-column shell: fixed sidebar + scrollable content */}
      <div className="flex">
        {/* Left column: app nav */}
        <Sidebar />

        {/* Right column: your page content */}
        <main className="flex-1 min-h-screen">
          {/* Inner container so your UI isn’t edge-to-edge */}
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
