// app/(app)/layout.tsx
'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-[#E2E8F0]">
      {/* Mobile Header with Hamburger */}
      <MobileHeader
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Two-column shell: fixed sidebar + scrollable content */}
      <div className="flex">
        {/* Left column: app nav */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Right column: your page content */}
        <main className="flex-1 min-h-screen">
          {/* 
            Mobile: top padding for fixed header, minimal side padding (full-width)
            Desktop: normal padding
          */}
          <div className="mx-auto max-w-[1400px] pt-16 md:pt-6 px-2 md:px-4 lg:px-8 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
