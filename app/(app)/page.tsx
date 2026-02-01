// app/(app)/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server'; // your helper
import HomeClient from './HomeClient';

export default async function Page() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  // If no session, middleware should have redirected already
  // But as a fallback, redirect to landing page (not login)
  if (!session) {
    redirect('/landing');
  }

  return <HomeClient />;
}
