// app/api/sessions/route.ts
// API routes for note_sessions (Session Mode)
export const runtime = 'nodejs';

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

// GET /api/sessions - List user's sessions
export async function GET() {
    const supabase = supa();

    const {
        data: { user },
        error: uerr,
    } = await supabase.auth.getUser();

    if (uerr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch sessions with hand count, ordered by active status and recency
    const { data: sessions, error } = await supabase
        .from('note_sessions')
        .select(`
      id,
      name,
      created_at,
      updated_at,
      is_active
    `)
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get hand counts per session
    const sessionIds = sessions?.map(s => s.id) || [];
    let handCounts: Record<string, number> = {};

    if (sessionIds.length > 0) {
        const { data: counts } = await supabase
            .from('hands')
            .select('session_id')
            .in('session_id', sessionIds);

        if (counts) {
            handCounts = counts.reduce((acc, hand) => {
                if (hand.session_id) {
                    acc[hand.session_id] = (acc[hand.session_id] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);
        }
    }

    // Merge hand counts into sessions
    const sessionsWithCounts = sessions?.map(s => ({
        ...s,
        hand_count: handCounts[s.id] || 0
    })) || [];

    return NextResponse.json({ ok: true, sessions: sessionsWithCounts });
}

// POST /api/sessions - Create new session
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
    const name = body?.name?.trim();

    if (!name) {
        return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
    }

    // Deactivate any existing active sessions for this user
    await supabase
        .from('note_sessions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

    // Create new active session
    const { data, error } = await supabase
        .from('note_sessions')
        .insert({
            user_id: user.id,
            name,
            is_active: true
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: data });
}

// PATCH /api/sessions - Update session (requires id in body)
export async function PATCH(req: Request) {
    const supabase = supa();

    const {
        data: { user },
        error: uerr,
    } = await supabase.auth.getUser();

    if (uerr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const sessionId = body?.id;

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Build update object
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.is_active !== undefined) {
        updates.is_active = body.is_active;

        // If activating this session, deactivate others
        if (body.is_active === true) {
            await supabase
                .from('note_sessions')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', sessionId);
        }
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('note_sessions')
        .update(updates)
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: data });
}

// DELETE /api/sessions - Delete session (requires id in body)
export async function DELETE(req: Request) {
    const supabase = supa();

    const {
        data: { user },
        error: uerr,
    } = await supabase.auth.getUser();

    if (uerr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const sessionId = body?.id;

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Delete session (hands will have session_id set to NULL via ON DELETE SET NULL)
    const { error } = await supabase
        .from('note_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
