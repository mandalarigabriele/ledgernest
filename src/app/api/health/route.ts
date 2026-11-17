import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/schema'
import { isDemoEnabled } from '@/lib/security'

// Unauthenticated liveness check used by the Docker healthcheck and deploy.sh.
// It also opens the database, so a missing or unwritable /data volume shows up as unhealthy.
// `demo` tells the login page whether to offer the demo button.
export const dynamic = 'force-dynamic'

export function GET() {
  try {
    getDb().prepare('SELECT 1').get()
    return NextResponse.json({ status: 'ok', demo: isDemoEnabled() })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
