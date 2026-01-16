// app/auth/reset-callback/route.ts
// Dedicated route for password reset callbacks - always redirects to update-password
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
    const { searchParams, origin } = new URL(req.url);
    const code = searchParams.get('code');

    if (code) {
        const supabase = createServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Always redirect to update-password for this route
            return NextResponse.redirect(`${origin}/auth/update-password`);
        }
    }

    // If there's an error or no code, redirect to login with error message
    return NextResponse.redirect(`${origin}/login?error=reset_link_expired`);
}
