// app/api/study/notes/route.ts
// CRUD API for user study notes - stored in study_chunks with source='note'
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import OpenAI from 'openai';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
});

// --- GET: List user's notes ---
export async function GET() {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const result = await pool.query(
            `SELECT id, content, tags, created_at 
             FROM public.study_chunks 
             WHERE user_id = $1 AND source = 'note'
             ORDER BY created_at DESC
             LIMIT 50`,
            [user.id]
        );

        return NextResponse.json({
            ok: true,
            notes: result.rows,
        });
    } catch (err: any) {
        console.error('[/api/study/notes GET] error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

// --- POST: Create a new note ---
export async function POST(req: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const content = (body.content as string)?.trim();
        const tags = (body.tags as string[]) || [];

        if (!content || content.length < 10) {
            return NextResponse.json({ ok: false, error: 'Note content too short (min 10 chars)' }, { status: 400 });
        }

        if (content.length > 5000) {
            return NextResponse.json({ ok: false, error: 'Note too long (max 5000 chars)' }, { status: 400 });
        }

        // Generate embedding for the note
        const embedResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: content,
        });
        const embedding = embedResp.data[0].embedding;
        const embeddingLiteral = `[${embedding.join(',')}]`;

        // Insert into study_chunks with source='note'
        const noteId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO public.study_chunks (
                id, user_id, source, content, tags, embedding, created_at
            ) VALUES ($1, $2, 'note', $3, $4, $5::vector, NOW())`,
            [noteId, user.id, content, tags, embeddingLiteral]
        );

        return NextResponse.json({
            ok: true,
            note: { id: noteId, content, tags },
        });
    } catch (err: any) {
        console.error('[/api/study/notes POST] error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

// --- DELETE: Remove a note ---
export async function DELETE(req: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const noteId = searchParams.get('id');

        if (!noteId) {
            return NextResponse.json({ ok: false, error: 'Note ID required' }, { status: 400 });
        }

        // Delete only if owned by user and is a note
        const result = await pool.query(
            `DELETE FROM public.study_chunks 
             WHERE id = $1 AND user_id = $2 AND source = 'note'
             RETURNING id`,
            [noteId, user.id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ ok: false, error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[/api/study/notes DELETE] error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
