// app/api/hands/[id]/replayer/route.ts
// API endpoint to fetch replayer data for a specific hand

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

function getSupabase() {
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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // In Next.js 14+, params is a Promise
    const { id: handId } = await params;

    if (!handId) {
        return NextResponse.json(
            { error: 'Hand ID is required' },
            { status: 400 }
        );
    }

    try {
        const supabase = getSupabase();

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        console.log('[Replayer API] Auth status:', {
            userId: user?.id || 'NOT_LOGGED_IN',
            authError: authError?.message || null,
            handId
        });

        // Fetch the hand with replayer_data
        let query = supabase
            .from('hands')
            .select('id, replayer_data, raw_text, user_id')
            .eq('id', handId);

        // If user is logged in, also filter by user_id for security
        if (user) {
            query = query.eq('user_id', user.id);
        }

        const { data: hand, error } = await query.single();

        if (error) {
            console.error('[Replayer API] Error fetching hand:', error);
            return NextResponse.json(
                { error: 'Hand not found', details: error.message, authStatus: user ? 'logged_in' : 'not_logged_in' },
                { status: 404 }
            );
        }

        // If replayer_data exists, return it
        if (hand.replayer_data && Object.keys(hand.replayer_data).length > 0) {
            return NextResponse.json({
                success: true,
                handId: hand.id,
                replayerData: hand.replayer_data,
            });
        }

        // If no replayer_data but we have raw_text, indicate parsing is needed
        if (hand.raw_text) {
            return NextResponse.json({
                success: false,
                handId: hand.id,
                message: 'Replayer data not yet parsed. Run replayer_parser.py to process.',
                hasRawText: true,
            });
        }

        return NextResponse.json({
            success: false,
            handId: hand.id,
            message: 'No hand history data available',
            hasRawText: false,
        });

    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json(
            { error: 'Internal server error', details: String(err) },
            { status: 500 }
        );
    }
}
