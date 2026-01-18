import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const COOKIE_NAME = 'session';

export async function middleware(request: NextRequest) {
  // Only apply to /profile routes
  if (!request.nextUrl.pathname.startsWith('/profile')) {
    return NextResponse.next();
  }

  // Get session cookie
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    // No session cookie, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify JWT token signature and expiration (works in Edge Runtime)
    const secret = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(sessionCookie.value, secret);
    
    // Check if token has userId
    if (!payload.userId || typeof payload.userId !== 'string') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Token is valid, allow request to proceed
    return NextResponse.next();
  } catch (error) {
    // Invalid token (expired, malformed, etc.), redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Only match /profile routes
     */
    '/profile/:path*',
  ],
};
