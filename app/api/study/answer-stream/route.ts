// app/api/study/answer-stream/route.ts
// Streaming version of the study answer API - sends chunks immediately then streams AI response
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import OpenAI from 'openai';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Force Node to accept Supabase's self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
});

// --- Types ---
type ChunkRow = {
    id: string;
    user_id: string;
    content: string;
    source: string | null;
    stakes_bucket: string | null;
    position: string | null;
    street: string | null;
    tags: string[] | null;
    score: number;
};

// --- Streaming Handler ---
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    // Create a readable stream
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Helper to send SSE events
                const sendEvent = (event: string, data: any) => {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                };

                if (!process.env.OPENAI_API_KEY) {
                    sendEvent('error', { message: 'OPENAI_API_KEY is not configured' });
                    controller.close();
                    return;
                }

                // 1) Auth
                const supabase = createRouteHandlerClient({ cookies });
                let userId: string | null = null;

                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) userId = user.id;
                } catch (e) {
                    console.warn('[/api/study/answer-stream] auth error:', e);
                }

                // 2) Parse body
                const body = await req.json().catch(() => ({}));
                const q = (body.q as string | undefined)?.trim() ?? '';
                const stakes = body.stakes as string | undefined;
                const position = body.position as string | undefined;
                const street = body.street as string | undefined;
                const history = (body.history as { role: string; content: string }[] | undefined) || [];
                const k = 5;

                if (!q) {
                    sendEvent('error', { message: 'Question (q) is required' });
                    controller.close();
                    return;
                }

                // 3) Embed the question
                sendEvent('status', { phase: 'embedding', message: 'Understanding your question...' });

                const embedResp = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: q,
                });

                const embedding = embedResp.data[0].embedding as unknown as number[];
                const embeddingLiteral = `[${embedding.join(',')}]`;

                // 4) Vector search with server-side filters
                sendEvent('status', { phase: 'searching', message: 'Searching your study notes...' });

                // Build parameterized query with filters in WHERE clause
                const params: any[] = [embeddingLiteral];
                let paramIndex = 2;

                // Build WHERE conditions
                const conditions: string[] = [];

                if (userId) {
                    conditions.push(`user_id = $${paramIndex}`);
                    params.push(userId);
                    paramIndex++;
                }

                if (position) {
                    conditions.push(`position_norm = $${paramIndex}`);
                    params.push(position);
                    paramIndex++;
                }

                if (street) {
                    conditions.push(`street = $${paramIndex}`);
                    params.push(street);
                    paramIndex++;
                }

                if (stakes) {
                    conditions.push(`stakes_bucket = $${paramIndex}`);
                    params.push(stakes);
                    paramIndex++;
                }

                const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
                params.push(k);

                const sqlText = `
                    SELECT
                        id, user_id, content, source, stakes_bucket,
                        position_norm as position,
                        street,
                        tags,
                        1 - (embedding <=> $1::vector) as score
                    FROM public.study_chunks
                    ${whereClause}
                    ORDER BY embedding <=> $1::vector
                    LIMIT $${paramIndex}
                `;

                const { rows } = await pool.query<ChunkRow>(sqlText, params);

                // Results already filtered by DB - just sort by score
                const chunks = rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

                // Send chunks immediately so UI can show them
                sendEvent('chunks', chunks.map(c => ({
                    id: c.id,
                    source_type: c.source,
                    title: c.source === 'hand' ? 'Hand context' : 'Study note',
                    content: c.content,
                    tags: c.tags,
                })));

                if (chunks.length === 0) {
                    sendEvent('summary', { text: "I couldn't find any matching notes or hands for this query yet. Try uploading more hand histories or adding study notes." });
                    sendEvent('done', {});
                    controller.close();
                    return;
                }

                // 5) Build context
                const contextText = chunks
                    .map((c, idx) => {
                        const tagsStr = (c.tags ?? []).join(', ');
                        return [
                            `Chunk ${idx + 1}`,
                            `source: ${c.source ?? 'unknown'}`,
                            `stakes: ${c.stakes_bucket ?? 'unknown'}`,
                            `position: ${c.position ?? 'unknown'}`,
                            `street: ${c.street ?? 'unknown'}`,
                            tagsStr ? `tags: ${tagsStr}` : '',
                            '',
                            c.content,
                        ].filter(Boolean).join('\n');
                    })
                    .join('\n\n---\n\n');

                // 6) Stream AI response
                sendEvent('status', { phase: 'thinking', message: 'AI Coach is analyzing...' });

                const systemPrompt =
                    'You are a professional poker strategy coach. ' +
                    'You analyse the user question and the provided study context (notes, hands, GTO snippets) ' +
                    'and return a JSON object with three keys: "summary", "rules", and "drills". ' +
                    '"summary" is 2–4 sentences. "rules" is an array of concise heuristics. ' +
                    '"drills" is an array of MULTIPLE-CHOICE quiz objects: { "id", "question", "options" (array of 4 choices), "correctIndex" (0-3), "explanation" }. ' +
                    'Make drill questions practical and actionable. Options should be distinct poker actions. ' +
                    'Focus on practical, NLH cash-game strategy at low/mid stakes. ' +
                    'Return ONLY valid JSON, no prose.' +
                    (history.length > 0 ? ' This is a follow-up question - consider the conversation history.' : '');

                const userPrompt = [
                    `User question: ${q}`,
                    '',
                    'Study context:',
                    contextText,
                    '',
                    'Return JSON in this shape:',
                    '{ "summary": "string", "rules": ["..."], "drills": [{ "id": "...", "question": "What action?", "options": ["Fold", "Call", "Raise 2.5x", "All-in"], "correctIndex": 2, "explanation": "why..." }] }',
                ].join('\n');

                // Build messages with conversation history for follow-ups
                const historyMessages = history.map((h: { role: string; content: string }) => ({
                    role: h.role as 'user' | 'assistant',
                    content: h.content,
                }));

                const chatStream = await openai.chat.completions.create({
                    model: 'gpt-4.1-mini',
                    temperature: 0.4,
                    stream: true,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...historyMessages,
                        { role: 'user', content: userPrompt },
                    ],
                });

                let fullContent = '';

                for await (const chunk of chatStream) {
                    const delta = chunk.choices[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        sendEvent('token', { text: delta });
                    }
                }

                // Parse the final JSON and send structured data
                try {
                    const parsed = JSON.parse(fullContent);
                    sendEvent('coach', {
                        summary: parsed.summary || '',
                        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
                        drills: Array.isArray(parsed.drills) ? parsed.drills.map((d: any, idx: number) => ({
                            id: d.id || `drill-${idx + 1}`,
                            question: d.question || '',
                            options: Array.isArray(d.options) ? d.options : [],
                            correctIndex: typeof d.correctIndex === 'number' ? d.correctIndex : 0,
                            explanation: d.explanation || '',
                        })) : [],
                    });
                } catch {
                    sendEvent('coach', {
                        summary: fullContent || 'Coach answer unavailable.',
                        rules: [],
                        drills: [],
                    });
                }

                sendEvent('done', {});
                controller.close();

            } catch (err: any) {
                console.error('[/api/study/answer-stream] error:', err);
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err?.message || 'Internal error' })}\n\n`));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
