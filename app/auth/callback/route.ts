// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  // Handles links like /auth/callback?code=...
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createServerClient();
    // this will set the cookies based on the code in the URL
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/', request.url));
}

export async function POST(request: Request) {
  // Handles events from AuthSync
  const supabase = createServerClient();
  const { event, session } = await request.json().catch(() => ({}));

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut(); // clears cookies
  }

  // If SIGNED_IN/USER_UPDATED etc., cookies were already set by the SDK
  return NextResponse.json({ ok: true });
}
