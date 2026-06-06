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
  if (!group) return NextResponse.json({ expenses: [] })

  const expenses = db.prepare(`
    SELECT * FROM shared_expenses WHERE group_id = ? ORDER BY date DESC, created_at DESC
  `).all(group.id)

  return NextResponse.json({ expenses })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  const body = await req.json() as {
    amount?: number
    description?: string
    category?: string
    date?: string
    payerEmail?: string
    otherShare?: number
    notes?: string
    sourceTxId?: string
  }

  const { amount, description, date, payerEmail, otherShare = 0.5, category, notes, sourceTxId } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: 'amount must be positive' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'description is required' }, { status: 400 })
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  // payer must be a member of the group
  const payer = payerEmail ?? session.user.email
  const members = [group.member1_email, group.member2_email]
  if (!members.includes(payer)) return NextResponse.json({ error: 'payerEmail is not a group member' }, { status: 400 })

  // prevent duplicates when coming from "mark as shared"
  if (sourceTxId) {
    const existing = db.prepare(
      `SELECT id FROM shared_expenses WHERE group_id = ? AND source_tx_id = ? LIMIT 1`
    ).get(group.id, sourceTxId)
    if (existing) return NextResponse.json({ error: 'already_shared' }, { status: 409 })
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO shared_expenses (id, group_id, payer_email, amount, description, category, date, other_share, notes, source_tx_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, group.id, payer, amount, description.trim(), category ?? null, date, otherShare, notes ?? null, sourceTxId ?? null)

  const expense = db.prepare('SELECT * FROM shared_expenses WHERE id = ?').get(id)
  return NextResponse.json({ expense }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sourceTxId = searchParams.get('sourceTxId')
  if (!sourceTxId) return NextResponse.json({ error: 'sourceTxId required' }, { status: 400 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  db.prepare(
    `DELETE FROM shared_expenses WHERE group_id = ? AND source_tx_id = ?`
  ).run(group.id, sourceTxId)

  return NextResponse.json({ ok: true })
}
