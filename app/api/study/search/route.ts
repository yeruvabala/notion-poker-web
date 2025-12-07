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

export async function GET(req: Request) {
  // 1) Auth: get current user from Supabase session
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("supabase.getUser error", userError);
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Parse query params
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    // Empty query -> just return nothing (frontend can handle this)
    return NextResponse.json({ chunks: [] });
  }

  const stakes = searchParams.get("stakes"); // e.g. '10NL'
  const position = searchParams.get("position"); // e.g. 'BTN'
  const street = searchParams.get("street"); // e.g. 'preflop'
  const tag = searchParams.get("tag"); // e.g. 'trips_management'
  const kParam = searchParams.get("k");
  const k = kParam ? Math.min(parseInt(kParam, 10) || 10, 50) : 10;

  // 3) Embed the query text
  let embeddingStr: string;
  try {
    const resp = await openai.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: q,
    });
    const embedding = resp.data[0].embedding as unknown as number[];
    // pgvector expects something like '[0.1, 0.2, ...]' which JSON.stringify already gives
    embeddingStr = JSON.stringify(embedding);
  } catch (err) {
    console.error("Error creating embedding", err);
    return NextResponse.json(
      { error: "Failed to create embedding" },
      { status: 500 }
    );
  }

  // 4) Normalise filters to null-or-value so we can use a simple boolean trick in SQL
  const stakesFilter = stakes || null;
  const posFilter = position || null;
  const streetFilter = street || null;
  const tagFilter = tag || null;

  // 5) Run pgvector search against study_chunks
  let rows;
  try {
    const result = await sql<{
      id: string;
      ref_id: string | null;
      source: string;
      content: string;
      tags: string[] | null;
      stakes_bucket: string | null;
      position_norm: string | null;
      street: string | null;
      score: number;
    }>`
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
      limit ${k};
    `;

    rows = result.rows;
  } catch (err) {
    console.error("Error querying study_chunks", err);
    return NextResponse.json(
      { error: "Failed to search study_chunks" },
      { status: 500 }
    );
  }

  // 6) Return a stable JSON structure the UI / RAG coach can consume
  return NextResponse.json({
    chunks: rows.map((r) => ({
      id: r.id,
      ref_id: r.ref_id,
      source: r.source,
      content: r.content,
      tags: r.tags || [],
      stakes_bucket: r.stakes_bucket,
      position_norm: r.position_norm,
      street: r.street,
      score: r.score,
    })),
  });
}
