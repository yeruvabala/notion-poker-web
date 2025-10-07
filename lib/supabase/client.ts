'use client';

import { createClient as createSupabaseBrowserClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Always return a valid browser client */
export function createClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // If env vars are missing, still return a client (it’ll fail at runtime if used).
  if (!url || !anon) {
    // You can optionally console.warn here.
  }

  cached = createSupabaseBrowserClient(url, anon);
  return cached;
}
