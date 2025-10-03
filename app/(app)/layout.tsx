// app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Sidebar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
