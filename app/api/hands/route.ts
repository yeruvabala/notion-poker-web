// app/api/hands/route.ts
export const runtime = 'nodejs'; // <-- ensure Node runtime, not Edge

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

function supa() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

export async function GET() {
  const supabase = supa();

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();

  if (uerr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('hands')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rows: data });
}

export async function POST(req: Request) {
  const supabase = supa();

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();

  if (uerr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));

  // Only accept the fields we store (avoid accidental extra props)
  const row = {
    user_id: user.id,
    date: body?.date ?? null,
    stakes: body?.stakes ?? null,
    position: body?.position ?? null,
    cards: body?.cards ?? null,
    board: body?.board ?? null,
    hand_class: body?.hand_class ?? null,
    source_used: body?.source_used ?? null,
    gto_strategy: body?.gto_strategy ?? null,
    exploit_deviation: body?.exploit_deviation ?? null,
    exploit_signals: body?.exploit_signals ?? null,  // NEW: Agent 7 data
    learning_tag: Array.isArray(body?.learning_tag) ? body.learning_tag : null,
    notes: body?.notes ?? null,
    // Session Mode fields
    source: body?.source ?? 'manual',  // 'upload', 'manual', 'quick_save'
    session_id: body?.session_id ?? null,  // UUID or null for quick saves
    is_favorited: body?.is_favorited ?? false,
  };

  const { data, error } = await supabase
    .from('hands')
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hand: data });
}
