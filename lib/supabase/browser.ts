// lib/supabase/browser.ts
'use client';

import { createBrowserClient as createClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// If you have generated DB types, pass it to the generic.
export function createBrowserClient(): SupabaseClient {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient;
}
