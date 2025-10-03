// lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createServerClient(): SupabaseClient {
  const cookieStore = cookies();

  const supabase = createSSRClient<any>(              // 👈 use a generic to quiet TS
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Cast to the plain SupabaseClient shape expected elsewhere
  return supabase as unknown as SupabaseClient;
}
