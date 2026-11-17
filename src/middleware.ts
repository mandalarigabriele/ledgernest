import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  // Demo mode: skip authentication, but only on instances started with DEMO_MODE=1.
  // Without that variable the cookie is ignored, so nobody can bypass the login by setting it.
  // (Inlined instead of imported from lib/security: the middleware runs in the Edge runtime,
  // which cannot load next-auth's server session code.)
  if (process.env.DEMO_MODE === '1' && req.cookies.has('ledgernest-demo')) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico).*)',
  ],
}
