import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Keep this route dynamic – we don't want it statically cached
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Same helper pattern as app/api/hands/route.ts
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
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignore – Next.js route handlers don't always allow setting cookies
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get('q') || '').trim();
    const stakes = searchParams.get('stakes') || null;
    const position = searchParams.get('position') || null;
    const street = searchParams.get('street') || null;
    const kRaw = searchParams.get('k');
    const k =
      kRaw != null
        ? Math.min(Math.max(parseInt(kRaw, 10) || 0, 1), 50)
        : 10;

    if (!q) {
      return NextResponse.json(
        { error: 'Missing q query param' },
        { status: 400 }
      );
    }

    const supabase = supa();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error('study/search getUser error:', userErr);
      return NextResponse.json(
        { error: 'Failed to read user session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // NOTE:
    // Right now your Study UI uses /api/study/answer for the real RAG
    // response. This endpoint is mainly for debugging. To keep things
    // safe and avoid schema mismatches, we just echo what the server sees.
    // Later we can plug a proper pgvector search in here.
    return NextResponse.json({
      ok: true,
      userId: user.id,
      q,
      stakes,
      position,
      street,
      k,
      note:
        'This is an authenticated stub for /api/study/search. The main Study UI uses /api/study/answer for coach + drills.',
    });
  } catch (err) {
    console.error('study/search error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
