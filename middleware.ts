// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // options can be undefined, so guard with spread
          res.cookies.set({ name, value, ...(options || {}) });
        },
        remove(name: string, options: any) {
          // clear cookie by setting empty value + maxAge 0
          res.cookies.set({
            name,
            value: '',
            ...(options || {}),
            maxAge: 0,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect root to landing page (main entry point for all users)
  const pathname = req.nextUrl.pathname;
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.redirect(url);
  }

  // Public: landing page + login + auth routes + static
  const publicPaths = ['/landing', '/login', '/auth/login', '/auth/callback', '/auth/update-password', '/auth/signout', '/privacy', '/delete-account'];
  const isPublic =
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next');

  // Guard app sections - require authentication
  const needsAuth = ['/hands', '/ranges', '/study', '/analytics', '/history', '/settings'].some((p) =>
    pathname.startsWith(p)
  );

  if (needsAuth && !user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
