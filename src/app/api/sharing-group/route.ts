import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

interface SharingGroupRow {
  id: string
  member1_email: string
  member2_email: string
  created_at: string
}

function getGroup(db: ReturnType<typeof getDb>, email: string): SharingGroupRow | undefined {
  return db.prepare(`
    SELECT * FROM sharing_groups
    WHERE member1_email = ? OR member2_email = ?
    LIMIT 1
  `).get(email, email) as SharingGroupRow | undefined
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = getGroup(db, session.user.email)
  if (!group) return NextResponse.json({ group: null })

  const partnerEmail = group.member1_email === session.user.email
    ? group.member2_email
    : group.member1_email

  return NextResponse.json({ group: { ...group, partnerEmail } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { partnerEmail } = await req.json() as { partnerEmail?: string }
  if (!partnerEmail || typeof partnerEmail !== 'string') {
    return NextResponse.json({ error: 'partnerEmail is required' }, { status: 400 })
  }
  const myEmail = session.user.email
  if (partnerEmail.toLowerCase() === myEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot pair with yourself' }, { status: 400 })
  }

  const db = getDb()

  // Check if either user is already in a group
  const existingMine = getGroup(db, myEmail)
  if (existingMine) {
    const partnerEmail2 = existingMine.member1_email === myEmail
      ? existingMine.member2_email
      : existingMine.member1_email
    return NextResponse.json({ group: { ...existingMine, partnerEmail: partnerEmail2 } })
  }

  const id = randomUUID()
  // Store emails in consistent order so the UNIQUE constraint works
  const [m1, m2] = [myEmail, partnerEmail].sort()
  db.prepare(`
    INSERT OR IGNORE INTO sharing_groups (id, member1_email, member2_email)
    VALUES (?, ?, ?)
  `).run(id, m1, m2)

  const group = getGroup(db, myEmail)!
  const partner = group.member1_email === myEmail ? group.member2_email : group.member1_email
  return NextResponse.json({ group: { ...group, partnerEmail: partner } }, { status: 201 })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = getGroup(db, session.user.email)
  if (!group) return NextResponse.json({ ok: true })

  db.prepare('DELETE FROM sharing_groups WHERE id = ?').run(group.id)
  return NextResponse.json({ ok: true })
}
