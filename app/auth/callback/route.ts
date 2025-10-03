// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as {
    event?: string;
    session?: { access_token?: string; refresh_token?: string } | null;
  };

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  } else if (session?.access_token && session.refresh_token) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }

  return NextResponse.json({ ok: true });
}
