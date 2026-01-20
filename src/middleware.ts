import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'session';

function isProbablyJwt(token: string): boolean {
  // JWT format: header.payload.signature (3 base64url-ish segments)
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0);
}

export async function middleware(request: NextRequest) {
  const isProtected =
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/squares');

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME);
  const token = sessionCookie?.value;

  if (!token || !isProbablyJwt(token)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Note: middleware runs on the Edge runtime; verifying the JWT signature here
  // would require WebCrypto and duplicating verification logic. The server-side
  // code (getUserFromSession -> verifySession) is authoritative.
  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/admin/:path*', '/dashboard/:path*', '/squares/:path*'],
};
