import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/banking/aspsps?country=IT
// Returns the list of available banks from Enable Banking
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appId  = process.env.ENABLEBANKING_APP_ID
  const rawKey = process.env.ENABLEBANKING_PRIVATE_KEY
  if (!appId || !rawKey) return NextResponse.json({ error: 'Enable Banking not configured' }, { status: 500 })

  // Build JWT inline (same logic as service)
  const crypto = await import('crypto')
  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const keyObject = crypto.createPrivateKey(privateKey)
  const isEC = keyObject.asymmetricKeyType === 'ec'
  const alg = isEC ? 'ES256' : 'RS256'
  const header  = Buffer.from(JSON.stringify({ alg, kid: appId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: 'enablebanking.com', sub: appId, aud: 'api.enablebanking.com', iat: now, exp: now + 3600 })).toString('base64url')
  const sigInput = `${header}.${payload}`
  const sig = isEC
    ? crypto.sign('SHA256', Buffer.from(sigInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    : crypto.sign('SHA256', Buffer.from(sigInput), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING })
  const jwt = `${sigInput}.${sig.toString('base64url')}`

  const country = req.nextUrl.searchParams.get('country') ?? 'IT'
  const search  = req.nextUrl.searchParams.get('search')?.toLowerCase()
  const res = await fetch(`https://api.enablebanking.com/aspsps?country=${country}&psu_type=personal`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const data = await res.json() as { aspsps?: { name: string }[] }
  if (search && data.aspsps) {
    return NextResponse.json({ aspsps: data.aspsps.filter((a) => a.name.toLowerCase().includes(search)) })
  }
  return NextResponse.json(data)
}
