// app/api/study/answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Drill = {
  question: string;
  answer: string;
  explanation: string;
};

type CoachResponse = {
  summary: string;
  rules: string[];
  drills: Drill[];
};

function normaliseFilter(value: string | null | undefined) {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'any' || v === 'any street' || v === 'all' || v === 'all stakes') {
    return null;
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const q: string = body.q;
    const stakes: string | null = body.stakes ?? null;
    const position: string | null = body.position ?? null;
    const street: string | null = body.street ?? null;
    const k: number = Number(body.k ?? 5);
    const userId: string | null = body.userId ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId in request body' },
        { status: 400 },
      );
    }

    if (!q || typeof q !== 'string') {
      return NextResponse.json(
        { error: 'q (question) is required' },
        { status: 400 },
      );
    }

    const stakesFilter = normaliseFilter(stakes);
    const positionFilter = normaliseFilter(position);
    const streetFilter = normaliseFilter(street);

    // 1) Embed the question
    const embed = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: q,
    });
    const embedding = embed.data[0].embedding;

    // 2) Vector search over study_chunks
    const { rows } = await sql<{
      id: number;
      user_id: string;
      content: string;
      stakes_bucket: string | null;
      position_norm: string | null;
      street: string | null;
      tags: string[] | null;
      source_type: string | null;
      source_id: string | null;
      meta: any;
      score: number;
    }>`
      select
        id,
        user_id,
        content,
        stakes_bucket,
        position_norm,
        street,
        tags,
        source_type,
        source_id,
        meta,
        1 - (embedding <=> ${embedding}::vector) as score
      from public.study_chunks
      where user_id = ${userId}
        and (${stakesFilter}::text is null or stakes_bucket = ${stakesFilter})
        and (${positionFilter}::text is null or position_norm = ${positionFilter})
        and (${streetFilter}::text is null or street = ${streetFilter})
      order by embedding <=> ${embedding}::vector
      limit ${isNaN(k) || k <= 0 ? 5 : k};
    `;

    // 3) Build context string for the model
    const contextBlocks = rows.map((r, idx) => {
      const metaBits: string[] = [];
      if (r.stakes_bucket) metaBits.push(`stakes=${r.stakes_bucket}`);
      if (r.position_norm) metaBits.push(`position=${r.position_norm}`);
      if (r.street) metaBits.push(`street=${r.street}`);
      if (r.tags && r.tags.length > 0)
        metaBits.push(`tags=${r.tags.join(',')}`);
      if (r.source_type) metaBits.push(`source=${r.source_type}`);

      const headerMeta =
        metaBits.length > 0 ? ` [${metaBits.join(' • ')}]` : '';

      return `[#${idx + 1}]${headerMeta}\n${r.content}`.trim();
    });

    const contextText =
      contextBlocks.length > 0
        ? contextBlocks.join('\n\n---\n\n')
        : 'No matching notes or hands were found for this player. Answer based on solid default GTO and exploitative heuristics for low-stakes online NLHE.';

    // 4) Call the coach model
    const systemPrompt = `
You are a poker strategy coach for 6-max online No-Limit Hold'em cash games.

You are given:
- A player question or leak description.
- Retrieved context from their study notes, GTO outputs, and hand histories.
Your job:
1) Summarize what is going on in this spot for this player.
2) List 3–7 clear rules/heuristics they should follow.
3) Produce 3–8 drills they can practice. Each drill should have:
   - question: a concise scenario or quiz-style question.
   - answer: the correct action or explanation.
   - explanation: why this is correct, referencing any relevant rules.

Be concise but specific. Assume stakes like 10NL–50NL online; avoid solver jargon that a serious but non-pro reg can’t follow.
`.trim();

    const userPrompt = `
Player question / focus:
"${q}"

Filters in UI:
- Stakes filter: ${stakesFilter ?? 'Any'}
- Position filter: ${positionFilter ?? 'Any'}
- Street filter: ${streetFilter ?? 'Any'}

Retrieved context (notes, hands, GTO snippets):
${contextText}

Now:
1) Give a 2–4 sentence summary of what's going on for this player.
2) List key rules as short bullet-point style strings.
3) Create practical drills focused exactly on this spot.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'coach_response',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              rules: {
                type: 'array',
                items: { type: 'string' },
              },
              drills: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    question: { type: 'string' },
                    answer: { type: 'string' },
                    explanation: { type: 'string' },
                  },
                  required: ['question', 'answer', 'explanation'],
                },
              },
            },
            required: ['summary', 'rules', 'drills'],
          },
        },
      },
      temperature: 0.5,
    });

    const messageContent = completion.choices[0]?.message?.content;
    let coach: CoachResponse | null = null;

    if (typeof messageContent === 'string') {
      try {
        coach = JSON.parse(messageContent) as CoachResponse;
      } catch {
        coach = null;
      }
    } else if (typeof messageContent === 'object' && messageContent !== null) {
      // If the SDK already parsed JSON for us
      coach = messageContent as unknown as CoachResponse;
    }

    return NextResponse.json({
      ok: true,
      coach,
      chunks: rows,
    });
  } catch (err: any) {
    console.error('Error in /api/study/answer:', err);
    return NextResponse.json(
      {
        error: 'Internal error while answering study question',
        detail: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
