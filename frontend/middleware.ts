import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protect admin routes
  if (path.startsWith('/admin')) {
    const tokenCookie = request.cookies.get('motion_token');
    if (!tokenCookie) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    try {
      const token = tokenCookie.value;
      const parts = token.split('.');
      if (parts.length !== 3) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Decode Base64URL JWT payload safely in Edge environment
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadDecoded);

      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (err) {
      console.error('Middleware JWT parsing failed:', err);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
