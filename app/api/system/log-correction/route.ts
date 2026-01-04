import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface CorrectionPayload {
    raw_input_text: string;
    parser_output: {
        heroPosition?: string;
        heroCards?: string;
        villainPosition?: string;
        effectiveStack?: number;
        scenario?: string;
    };
    user_corrected: {
        heroPosition?: string;
        heroCards?: string;
        villainPosition?: string;
        effectiveStack?: number;
        scenario?: string;
    };
    was_ai_fallback?: boolean;
    parsing_confidence?: number;
    session_id?: string;
}

/**
 * POST /api/system/log-correction
 * 
 * Fire-and-forget endpoint to log parser corrections.
 * Used by frontend when user modifies parsed values before analysis.
 * 
 * This data powers the "flywheel" for continuous improvement:
 * - Identify common regex failures
 * - Track AI fallback accuracy
 * - Prioritize fixes based on frequency
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user (optional - works for anonymous too)
        const { data: { user } } = await supabase.auth.getUser();

        // Parse request body
        const body: CorrectionPayload = await request.json();
        const {
            raw_input_text,
            parser_output,
            user_corrected,
            was_ai_fallback = false,
            parsing_confidence,
            session_id
        } = body;

        // Validate required fields
        if (!raw_input_text || !parser_output || !user_corrected) {
            return NextResponse.json(
                { error: 'Missing required fields: raw_input_text, parser_output, user_corrected' },
                { status: 400 }
            );
        }

        // Determine what was corrected
        const corrections: string[] = [];

        if (parser_output.heroPosition !== user_corrected.heroPosition) {
            corrections.push('position');
        }
        if (parser_output.heroCards !== user_corrected.heroCards) {
            corrections.push('cards');
        }
        if (parser_output.villainPosition !== user_corrected.villainPosition) {
            corrections.push('villain');
        }
        if (parser_output.effectiveStack !== user_corrected.effectiveStack) {
            corrections.push('stack');
        }
        if (parser_output.scenario !== user_corrected.scenario) {
            corrections.push('scenario');
        }

        // Don't log if nothing was actually corrected
        if (corrections.length === 0) {
            return NextResponse.json({
                success: true,
                logged: false,
                message: 'No corrections detected, skipping log'
            });
        }

        // Get user agent for debugging
        const userAgent = request.headers.get('user-agent') || undefined;

        // Insert correction log
        const { error } = await supabase
            .from('parser_corrections')
            .insert({
                raw_input_text,
                parser_output_json: parser_output,
                user_corrected_json: user_corrected,
                user_id: user?.id || null,
                correction_type: corrections.join(','),
                was_ai_fallback,
                parsing_confidence,
                session_id,
                user_agent: userAgent
            });

        if (error) {
            console.error('[Correction Log] Insert error:', error);
            // Don't fail the request - this is fire-and-forget
            return NextResponse.json({
                success: false,
                logged: false,
                error: 'Failed to log correction'
            });
        }

        console.log('[Correction Log] Saved:', {
            corrections,
            was_ai_fallback,
            parsing_confidence,
            user: user?.id ? 'authenticated' : 'anonymous'
        });

        return NextResponse.json({
            success: true,
            logged: true,
            corrections
        });

    } catch (error: any) {
        console.error('[Correction Log] Exception:', error.message);
        // Always return success - this is non-critical
        return NextResponse.json({
            success: false,
            logged: false,
            error: 'Internal error'
        });
    }
}

/**
 * GET /api/system/log-correction
 * 
 * Health check endpoint
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'parser-correction-logger',
        version: '1.0'
    });
}
