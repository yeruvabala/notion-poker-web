export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server'; // ← change

export async function POST(req: Request) {
  const sb = createServerClient(); // ← change
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { storage_path, original_filename, file_size_bytes, mime_type } = body || {};
  if (!storage_path) return NextResponse.json({ error: 'storage_path required' }, { status: 400 });

  const { error } = await sb.from('hand_files').insert({
    user_id: user.id,
    storage_path,
    status: 'new',
    // original_filename, file_size_bytes, mime_type
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
