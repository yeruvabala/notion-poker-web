import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { sql } from "@vercel/postgres";
import OpenAI from "openai";

// Force Node runtime so Supabase + pgvector are happy (not Edge)
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

const COACH_MODEL =
  process.env.STUDY_COACH_MODEL || "gpt-4.1-mini";

// ----------------------------
// Types we’ll return to the UI
// ----------------------------
type DrillItem = {
  question: string;
  answer: string;
  explanation?: string;
};

type CoachResponse = {
  summary: string;          // high-level explanation
  rules: string[];          // bullet-point rules / heuristics
  drills: DrillItem[];      // quiz cards
  citations: string[];      // study_chunk ids used
};

// ----------------------------
// Helper: fetch user via Supabase
// ----------------------------
async function getCurrentUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("supabase.getUser error", error);
  }

  return user;
}

// ----------------------------
// Main handler
// ----------------------------

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawQ = (body.q || "").trim();
  if (!rawQ) {
    return NextResponse.json(
      { error: "q (question) is required" },
      { status: 400 }
    );
  }

  const stakes = body.stakes as string | undefined;   // '10NL'
  const position = body.position as string | undefined; // 'BTN'
  const street = body.street as string | undefined;   // 'preflop'
  const tag = body.tag as string | undefined;         // 'trips_management'
  const kContext = Math.min(body.k ?? 12, 40);        // how many chunks for context

  // 1) Embed the question
  let embeddingStr: string;
  try {
    const resp = await openai.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: rawQ,
    });
    const embedding = resp.data[0].embedding as unknown as number[];
    embeddingStr = JSON.stringify(embedding); // pgvector expects "[...]"
  } catch (err) {
    console.error("Error creating embedding for question", err);
    return NextResponse.json(
      { error: "Failed to create embedding" },
      { status: 500 }
    );
  }

  const stakesFilter = stakes || null;
  const posFilter = position || null;
  const streetFilter = street || null;
  const tagFilter = tag || null;

  // 2) Retrieve top-K relevant study_chunks for this user
  type ChunkRow = {
    id: string;
    ref_id: string | null;
    source: string;
    content: string;
    tags: string[] | null;
    stakes_bucket: string | null;
    position_norm: string | null;
    street: string | null;
    score: number;
  };

  let chunks: ChunkRow[];
  try {
    const result = await sql<ChunkRow>`
      select
        id,
        ref_id,
        source,
        content,
        tags,
        stakes_bucket,
        position_norm,
        street,
        1 - (embedding <=> ${embeddingStr}::vector) as score
      from public.study_chunks
      where user_id = ${user.id}
        and (${stakesFilter === null} or stakes_bucket = ${stakesFilter})
        and (${posFilter === null} or position_norm = ${posFilter})
        and (${streetFilter === null} or street = ${streetFilter})
        and (
          ${tagFilter === null}
          or ${tagFilter} = ANY(tags)
        )
      order by embedding <=> ${embeddingStr}::vector
      limit ${kContext};
    `;
    chunks = result.rows;
  } catch (err) {
    console.error("Error querying study_chunks in /api/study/answer", err);
    return NextResponse.json(
      { error: "Failed to search study_chunks" },
      { status: 500 }
    );
  }

  if (!chunks.length) {
    return NextResponse.json({
      coach: {
        summary:
          "I couldn't find matching study notes or hands for this spot in your library yet.",
        rules: [],
        drills: [],
        citations: [],
      } as CoachResponse,
      chunks: [],
    });
  }

  // 3) Build context string for the LLM
  const contextBlocks = chunks.map((c, idx) => {
    const idxLabel = idx + 1;
    const tagsLabel = c.tags && c.tags.length ? c.tags.join(", ") : "none";
    const posLabel = c.position_norm || "unknown position";
    const stakesLabel = c.stakes_bucket || "unknown stakes";
    const streetLabel = c.street || "unknown street";

    return [
      `[${idxLabel}] source=${c.source} ref_id=${c.ref_id ?? "n/a"}`,
      `stakes=${stakesLabel}, position=${posLabel}, street=${streetLabel}`,
      `tags=${tagsLabel}`,
      `content:`,
      c.content,
    ].join("\n");
  });

  const contextText = contextBlocks.join("\n\n---\n\n");

  // 4) Ask the coach model to synthesize an answer + drills
  const systemPrompt = `
You are a no-limit holdem poker coach.

You are given:
- A player's question about a situation or leak.
- A set of context snippets from their own study notes and hand histories.

Use ONLY that context. If something is not covered, say you don't have enough info.

Return JSON with the following TypeScript shape:

{
  "summary": string,              // 2–4 sentences explaining what's going wrong + key ideas
  "rules": string[],              // 3–8 bullet-point rules / heuristics in plain language
  "drills": [                     // 3–6 practice questions
    {
      "question": string,         // the scenario/question
      "answer": string,           // the correct answer in 1–2 sentences
      "explanation"?: string      // optional deeper explanation
    }
  ],
  "citations": string[]           // list of chunk ids (from the 'id=' field) you used most
}

Important:
- The JSON MUST be valid. Do not wrap it in markdown. No extra commentary.
- Use simple text; avoid LaTeX.
- When referencing context, think in terms of exploit vs GTO when appropriate, but stay grounded in the snippets.
`;

  const userPrompt = `
Player question:
"${rawQ}"

Context (study_chunks):
${contextText}
`;

  let coachRaw: string;
  try {
    const chat = await openai.chat.completions.create({
      model: COACH_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    coachRaw = chat.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("Error calling coach model", err);
    return NextResponse.json(
      { error: "Failed to call coach model" },
      { status: 500 }
    );
  }

  // 5) Parse JSON; if it fails, fall back to a simple wrapper
  let coach: CoachResponse;
  try {
    coach = JSON.parse(coachRaw) as CoachResponse;
  } catch (err) {
    console.warn("Failed to parse coach JSON, returning fallback", err);
    coach = {
      summary: coachRaw || "Coach response could not be parsed.",
      rules: [],
      drills: [],
      citations: [],
    };
  }

  // 6) Return both coach output + raw chunks (for debug / UI later)
  return NextResponse.json({
    coach,
    chunks: chunks.map((c) => ({
      id: c.id,
      ref_id: c.ref_id,
      source: c.source,
      content: c.content,
      tags: c.tags || [],
      stakes_bucket: c.stakes_bucket,
      position_norm: c.position_norm,
      street: c.street,
      score: c.score,
    })),
  });
}
