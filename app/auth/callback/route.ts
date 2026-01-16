// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET handler for email link callbacks (password reset, email verification, etc.)
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';
  const type = searchParams.get('type'); // 'recovery' for password reset

  if (code) {
    const supabase = createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // For password recovery, redirect to update-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
      // For other types (signup confirmation, etc.), redirect to next or home
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

export async function POST(req: Request) {
  try {
    const { event, session } = await req.json().catch(() => ({}));
    const supabase = createServerClient();

    if (!event) {
      return NextResponse.json({ ok: true });
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session) {
        await supabase.auth.setSession(session);
      }
    }

    if (event === 'SIGNED_OUT') {
      await supabase.auth.signOut();
    }

    // No content needed; cookies were set in the SSR helper.
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'callback failed' }, { status: 500 });
  }
}
