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

  // Redirect root based on authentication status
  const pathname = req.nextUrl.pathname;
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    // Authenticated users go to app, unauthenticated users go to landing/login
    if (user) {
      // User is logged in - let them through to the app (no redirect needed)
      // The (app)/page.tsx will render for authenticated users
    } else {
      // User is not logged in
      // Check if this is a native app (iOS/Android) via user-agent
      const userAgent = req.headers.get('user-agent') || '';
      const isNativeApp = userAgent.includes('Capacitor') ||
        userAgent.includes('OnlyPoker') ||
        (userAgent.includes('Mobile') && (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('Android')));

      if (isNativeApp) {
        // Native app users go directly to login
        url.pathname = '/login';
      } else {
        // Web users go to landing page
        url.pathname = '/landing';
      }
      return NextResponse.redirect(url);
    }
  }

  // Public: landing page + login + auth routes + static
  const publicPaths = ['/landing', '/login', '/auth/login', '/auth/callback', '/auth/update-password', '/auth/signout', '/privacy', '/delete-account', '/support', '/terms'];
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
