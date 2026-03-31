import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Extract role from the authentication cookie
  const authCookie = request.cookies.get('nexora_role');

  const isAuthenticated = !!authCookie;

  // 1. Prevent unauthenticated access to the secured void (Dashboard)
  if (pathname.startsWith('/dashboard') && !isAuthenticated) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // 2. Prevent already authenticated users from seeing Auth page or Landing page
  if ((pathname === '/' || pathname === '/auth') && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard/chats', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/auth', '/dashboard/:path*'],
};
