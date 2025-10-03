// app/(app)/layout.tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar'; // remove if you don’t want the sidebar

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Server-side check: if no user, send to /login
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect('/login');
  }

  // Render your protected UI (with sidebar if you have one)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        {/* Optional sidebar */}
        <Sidebar />
        <main className="min-h-screen flex-1">
          {/* Give the page some breathing room */}
          <div className="mx-auto max-w-6xl p-6 md:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
