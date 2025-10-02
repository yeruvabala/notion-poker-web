// lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient as createSSRClient } from '@supabase/ssr';

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Return a dummy client shape (null) so callers can guard gracefully
    return null as unknown as ReturnType<typeof createSSRClient>;
  }

  const cookieStore = cookies();

  return createSSRClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        // Supabase expects remove to behave like set with an expired cookie
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
}
