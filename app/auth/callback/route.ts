// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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
