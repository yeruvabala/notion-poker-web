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

  // Public: home page + auth routes + static
  const pathname = req.nextUrl.pathname;
  const publicPaths = ['/', '/auth/login', '/auth/callback'];
  const isPublic =
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith('/_next');

  // Guard app sections
  const needsAuth = ['/hands', '/ranges', '/study', '/analytics'].some((p) =>
    pathname.startsWith(p)
  );

  if (needsAuth && !user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
