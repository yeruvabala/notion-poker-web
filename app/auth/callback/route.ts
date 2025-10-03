// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Handle PKCE email links: /auth/callback?code=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  // Create a server-side supabase client that can set/read auth cookies
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  if (code) {
    // Exchange the code for a session (sets the auth cookies)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // If something went wrong, send them to login (optionally add ?error=)
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // Success (or no code) — go to home
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}
