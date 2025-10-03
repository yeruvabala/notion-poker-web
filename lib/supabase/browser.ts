// lib/supabase/browser.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Single shared browser client.
 * We expose it as a **named** export `createBrowserClient`
 * so imports like `import { createBrowserClient } from '@/lib/supabase/browser'`
 * work exactly as your code expects.
 */
export function createBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  _client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles PKCE deep-links automatically
    },
  });

  return _client;
}
