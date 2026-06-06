import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

interface SharingGroupRow { id: string; member1_email: string; member2_email: string }

function requireGroup(db: ReturnType<typeof getDb>, email: string): SharingGroupRow | null {
  return db.prepare(`
    SELECT * FROM sharing_groups WHERE member1_email = ? OR member2_email = ? LIMIT 1
  `).get(email, email) as SharingGroupRow | null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ settlements: [] })

  const settlements = db.prepare(`
    SELECT * FROM settlements WHERE group_id = ? ORDER BY date DESC, created_at DESC
  `).all(group.id)

  return NextResponse.json({ settlements })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  const body = await req.json() as {
    amount?: number
    date?: string
    fromEmail?: string
    notes?: string
  }

  const { amount, date, fromEmail, notes } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: 'amount must be positive' }, { status: 400 })
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const from = fromEmail ?? session.user.email
  const members = [group.member1_email, group.member2_email]
  if (!members.includes(from)) return NextResponse.json({ error: 'fromEmail is not a group member' }, { status: 400 })

  const to = members.find((m) => m !== from)!

  const id = randomUUID()
  db.prepare(`
    INSERT INTO settlements (id, group_id, from_email, to_email, amount, date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, group.id, from, to, amount, date, notes ?? null)

  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(id)
  return NextResponse.json({ settlement }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  db.prepare('DELETE FROM settlements WHERE id = ? AND group_id = ?').run(id, group.id)
  return NextResponse.json({ ok: true })
}
