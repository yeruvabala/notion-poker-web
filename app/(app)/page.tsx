// app/(app)/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server'; // your helper
import HomeClient from './HomeClient';

export default async function Page() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return <HomeClient />;
}
