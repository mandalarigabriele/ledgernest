import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Demo mode lets visitors open the app without signing in (cookie `ledgernest-demo`).
 * It is a bypass of the login check, so it is off unless the server is started with DEMO_MODE=1.
 * Never enable it on an instance that holds real data.
 */
export function isDemoEnabled(): boolean {
  return process.env.DEMO_MODE === '1'
}

/** Development-only routes (e.g. /api/dev/*) answer 404 in production builds. */
export function isDevRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/**
 * Returns the signed-in session, or a 401 response to return as is.
 * Route handlers must call this themselves: the middleware is not the only line of defence.
 */
export async function requireSession(): Promise<
  { session: Session & { user: { email: string } }; response?: undefined } | { session?: undefined; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session: session as Session & { user: { email: string } } }
}
