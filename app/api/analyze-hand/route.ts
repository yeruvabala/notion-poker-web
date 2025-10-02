// app/api/analyze-hand/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase/server';

// (Keep default Node.js runtime; don't set runtime = 'edge' because we read cookies)
export async function POST(req: Request) {
  try {
    // Body the client sends (keep loose to avoid type friction)
    const body = await req.json().catch(() => ({} as any));

    // Create server-side Supabase client (cookie-based session)
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing Supabase env vars' },
        { status: 500 }
      );
    }

    // Accept access token from Authorization header *or* from cookies
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : undefined;

    const { data: userData, error: userErr } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ==== Your analysis logic (OpenAI or otherwise) ====
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build a simple prompt from inputs you already collect on the client
    const prompt = [
      'You are a poker coach. Summarize strategy and exploits for this hand.',
      'Return short, clear bullets. If details are missing, be generic.',
      '',
      'INPUT JSON:',
      JSON.stringify(body, null, 2),
    ].join('\n');

    // Minimal example using Responses API
    const completion = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
    });

    const text = (completion as any)?.output_text?.trim?.() || 'No output generated';

    // Shape the response for your UI
    const payload = {
      ok: true,
      gto_strategy: text,     // your UI shows this in the GTO box
      exploit_deviation: '',  // fill / parse if you want
      learning_tag: [] as string[],
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('analyze-hand error:', err);
    return NextResponse.json(
      { error: err?.message || 'Analyze failed' },
      { status: 500 }
    );
  }
}
