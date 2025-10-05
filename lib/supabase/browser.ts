'use client';

// Use the plain browser client in the browser, not @supabase/ssr
import { createClient as createSupabaseBrowserClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    // Still return a client to avoid null errors; it will fail on use if misconfigured
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  client = createSupabaseBrowserClient(url, anon);
  return client;
}
