import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'

interface SharedExpenseRow {
  id: string
  group_id: string
  payer_email: string
  amount: number
  currency: string
  description: string
  category: string | null
  date: string
  other_share: number
  notes: string | null
}

interface SharingGroupRow { id: string; member1_email: string; member2_email: string }

function requireGroup(db: ReturnType<typeof getDb>, email: string): SharingGroupRow | null {
  return db.prepare(`
    SELECT * FROM sharing_groups WHERE member1_email = ? OR member2_email = ? LIMIT 1
  `).get(email, email) as SharingGroupRow | null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  const expense = db.prepare('SELECT * FROM shared_expenses WHERE id = ?').get(params.id) as SharedExpenseRow | undefined
  if (!expense || expense.group_id !== group.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json() as Partial<{
    amount: number
    description: string
    category: string | null
    date: string
    payerEmail: string
    otherShare: number
    notes: string | null
  }>

  const members = [group.member1_email, group.member2_email]
  if (body.payerEmail && !members.includes(body.payerEmail)) {
    return NextResponse.json({ error: 'payerEmail is not a group member' }, { status: 400 })
  }

  db.prepare(`
    UPDATE shared_expenses SET
      amount = COALESCE(?, amount),
      description = COALESCE(?, description),
      category = ?,
      date = COALESCE(?, date),
      payer_email = COALESCE(?, payer_email),
      other_share = COALESCE(?, other_share),
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.amount ?? null,
    body.description?.trim() ?? null,
    body.category !== undefined ? body.category : expense.category,
    body.date ?? null,
    body.payerEmail ?? null,
    body.otherShare ?? null,
    body.notes !== undefined ? body.notes : expense.notes,
    params.id,
  )

  const updated = db.prepare('SELECT * FROM shared_expenses WHERE id = ?').get(params.id)
  return NextResponse.json({ expense: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const group = requireGroup(db, session.user.email)
  if (!group) return NextResponse.json({ error: 'No sharing group found' }, { status: 404 })

  const expense = db.prepare('SELECT * FROM shared_expenses WHERE id = ?').get(params.id) as SharedExpenseRow | undefined
  if (!expense || expense.group_id !== group.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  db.prepare('DELETE FROM shared_expenses WHERE id = ?').run(params.id)
  return NextResponse.json({ ok: true })
}
