// app/auth/signout/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing Supabase env vars' },
      { status: 500 }
    );
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
