import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { sql } from "@vercel/postgres";
import OpenAI from "openai";

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
  let embedding: number[];
  try {
    const resp = await openai.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: q,
    });
    embedding = resp.data[0].embedding as unknown as number[];
  } catch (err) {
    console.error("Error creating embedding", err);
    return NextResponse.json(
      { error: "Failed to create embedding" },
      { status: 500 }
    );
  }

  // 4) Build dynamic SQL filters
  // We use @vercel/postgres' sql`` helper so we stay safe from injection.
  const whereParts = [
    sql`user_id = ${user.id}`, // always scope to this user
  ];

  if (stakes) {
    whereParts.push(sql`stakes_bucket = ${stakes}`);
  }
  if (position) {
    whereParts.push(sql`position_norm = ${position}`);
  }
  if (street) {
    whereParts.push(sql`street = ${street}`);
  }
  if (tag) {
    // tag must be present in tags[]
    whereParts.push(sql`${tag} = ANY(tags)`);
  }

  // Combine into a single WHERE clause: cond1 AND cond2 AND ...
  // sql.join joins multiple fragments with a separator.
  const whereClause = sql`${sql.join(whereParts, sql` AND `)}`;

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
        1 - (embedding <=> ${embedding}::vector) as score
      from public.study_chunks
      where ${whereClause}
      order by embedding <=> ${embedding}::vector
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
