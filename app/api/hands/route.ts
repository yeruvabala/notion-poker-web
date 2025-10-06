import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function supa() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  );
}

export async function GET() {
  const supabase = supa();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('hands')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data });
}

export async function POST(req: Request) {
  const supabase = supa();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Harden input: accept only the fields we store
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
    learning_tag: Array.isArray(body?.learning_tag) ? body.learning_tag : null,
    notes: body?.notes ?? null,
  };

  const { data, error } = await supabase
    .from('hands')
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, hand: data });
}
