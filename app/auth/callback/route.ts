// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server'; // your server helper

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { event, session } = await req.json();

  // When signed in or refreshed, store the session in cookies so server layouts see it
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // @ts-ignore - session type from Supabase
    await supabase.auth.setSession(session);
  }

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}
