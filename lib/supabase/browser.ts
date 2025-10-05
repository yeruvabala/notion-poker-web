// lib/supabase/browser.ts
'use client';

import {
  createClient as createSupabaseBrowserClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** A single browser client instance for the whole app. */
export function createBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  cached = createSupabaseBrowserClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cached;
}
