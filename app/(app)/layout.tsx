// app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // server-side session check
  const supabase = createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <Sidebar />
        <main className="min-h-screen flex-1">
          <div className="mx-auto max-w-6xl p-6 md:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
