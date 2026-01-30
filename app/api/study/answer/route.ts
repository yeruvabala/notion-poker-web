// app/api/study/answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import OpenAI from 'openai';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Required for Supabase Postgres pooler connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Re-use a single PG pool for Supabase
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Types -------------------------------------------------------------------

type Drill = {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
};

type CoachResult = {
  summary: string;
  rules: string[];
  drills: Drill[];
};

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

// --- Handler -----------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'OPENAI_API_KEY is not configured' },
        { status: 500 },
      );
    }

    // 1) Try to read Supabase user from cookies (best-effort)
    const supabase = createRouteHandlerClient({ cookies });
    let userId: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.warn('[/api/study/answer] auth error (ignored):', authError.message);
      } else if (user) {
        userId = user.id;
      }
    } catch (e) {
      console.warn('[/api/study/answer] getUser threw (ignored):', e);
    }

    // 2) Parse body
    const body = await req.json().catch(() => ({}));
    const q = (body.q as string | undefined)?.trim() ?? '';
    const stakes = body.stakes as string | undefined;
    const position = body.position as string | undefined;
    const street = body.street as string | undefined;
    const kRaw = Number(body.k ?? 5);
    const k = Number.isFinite(kRaw) && kRaw > 0 ? Math.min(kRaw, 20) : 5;

    if (!q) {
      return NextResponse.json(
        { ok: false, error: 'Question (q) is required' },
        { status: 400 },
      );
    }

    // 3) Embed the question
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: q,
    });

    const embedding = embedResp.data[0].embedding as unknown as number[];
    const embeddingLiteral = `[${embedding.join(',')}]`;

    // 4) Vector search in study_chunks
    const overFetch = k * 4;

    const params: any[] = [embeddingLiteral];
    let where = '';
    if (userId) {
      params.push(userId);
      where = `where user_id = $2`;
    }
    const limitParamIndex = params.length + 1;
    params.push(overFetch);

    const sqlText = `
  select
    id,
    user_id,
    content,
    source,
    stakes_bucket,
    position_norm as position,
    null::text as street,  -- street_reached not present in your table yet
    tags,
    1 - (embedding <=> $1::vector) as score
  from public.study_chunks
  ${where}
  order by embedding <=> $1::vector
  limit $${limitParamIndex};
`;

    const { rows } = await pool.query<ChunkRow>(sqlText, params);

    let chunks = rows;

    // Filter client-side by stakes/position/street
    chunks = chunks.filter((c) => {
      if (stakes && c.stakes_bucket !== stakes) return false;
      if (position && c.position !== position) return false;
      if (street && c.street !== street) return false;
      return true;
    });

    chunks = chunks
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, k);

    if (chunks.length === 0) {
      const emptyCoach: CoachResult = {
        summary:
          "I couldn't find any matching notes or hands for this query yet. Try uploading more hand histories or adding study notes.",
        rules: [],
        drills: [],
      };
      return NextResponse.json({
        ok: true,
        coach: emptyCoach,
        chunks: [],
      });
    }

    // 5) Build context string for the model
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
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n---\n\n');

    // 6) Ask OpenAI to produce JSON: summary + rules + drills
    const systemPrompt =
      'You are a professional poker strategy coach. ' +
      'You analyse the user question and the provided study context (notes, hands, GTO snippets) ' +
      'and return a JSON object with three keys: "summary", "rules", and "drills". ' +
      '"summary" is 2–4 sentences. "rules" is an array of concise heuristics. ' +
      '"drills" is an array of objects: { "id", "question", "answer", "explanation" }. ' +
      'Focus on practical, NLH cash-game strategy at low/mid stakes. ' +
      'Return ONLY valid JSON, no prose.';

    const userPrompt = [
      `User question: ${q}`,
      '',
      'Study context:',
      contextText,
      '',
      'Return JSON in this shape (keys required):',
      '{',
      '  "summary": "string",',
      '  "rules": ["rule 1", "rule 2", "..."],',
      '  "drills": [',
      '    { "id": "drill-1", "question": "Q?", "answer": "A", "explanation": "why" }',
      '  ]',
      '}',
    ].join('\n');

    const chat = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = chat.choices[0]?.message?.content ?? '{}';

    let coach: CoachResult;

    try {
      const parsed = JSON.parse(content);

      coach = {
        summary:
          typeof parsed.summary === 'string'
            ? parsed.summary
            : 'Here is a high-level summary of this spot.',
        rules: Array.isArray(parsed.rules)
          ? parsed.rules.map((r: any) => String(r)).filter(Boolean)
          : [],
        drills: Array.isArray(parsed.drills)
          ? parsed.drills.map((d: any, idx: number) => ({
            id: String(d.id ?? `drill-${idx + 1}`),
            question: String(d.question ?? ''),
            answer: String(d.answer ?? ''),
            explanation:
              d.explanation != null ? String(d.explanation) : undefined,
          }))
          : [],
      };
    } catch {
      coach = {
        summary: content || 'Coach answer is unavailable for this query.',
        rules: [],
        drills: [],
      };
    }

    return NextResponse.json({
      ok: true,
      coach,
      chunks,
    });
  } catch (err: any) {
    console.error('[/api/study/answer] error', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal error' },
      { status: 500 },
    );
  }
}
