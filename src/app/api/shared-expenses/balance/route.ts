import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const myEmail = session.user.email
  const db = getDb()

  const group = db.prepare(`
    SELECT * FROM sharing_groups WHERE member1_email = ? OR member2_email = ? LIMIT 1
  `).get(myEmail, myEmail) as { id: string; member1_email: string; member2_email: string } | undefined

  if (!group) {
    return NextResponse.json({ balance: 0, partnerOwesMe: 0, iOwePartner: 0, totalShared: 0, currency: 'EUR' })
  }

  const partnerEmail = group.member1_email === myEmail ? group.member2_email : group.member1_email

  // What partner owes me: expenses where I paid
  const { partnerOwesMe } = db.prepare(`
    SELECT COALESCE(SUM(amount * other_share), 0) AS partnerOwesMe
    FROM shared_expenses
    WHERE group_id = ? AND payer_email = ?
  `).get(group.id, myEmail) as { partnerOwesMe: number }

  // What I owe partner: expenses where partner paid
  const { iOwePartner } = db.prepare(`
    SELECT COALESCE(SUM(amount * other_share), 0) AS iOwePartner
    FROM shared_expenses
    WHERE group_id = ? AND payer_email = ?
  `).get(group.id, partnerEmail) as { iOwePartner: number }

  // Settlements: money received by me (reduces partner debt)
  const { received } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS received
    FROM settlements
    WHERE group_id = ? AND to_email = ?
  `).get(group.id, myEmail) as { received: number }

  // Settlements: money paid by me (reduces my debt)
  const { paid } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS paid
    FROM settlements
    WHERE group_id = ? AND from_email = ?
  `).get(group.id, myEmail) as { paid: number }

  // Total shared amount (both sides)
  const { totalShared } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS totalShared FROM shared_expenses WHERE group_id = ?
  `).get(group.id) as { totalShared: number }

  // Positive = partner owes me; negative = I owe partner
  const balance = partnerOwesMe - iOwePartner + received - paid

  return NextResponse.json({
    balance: Math.round(balance * 100) / 100,
    partnerOwesMe: Math.round(partnerOwesMe * 100) / 100,
    iOwePartner: Math.round(iOwePartner * 100) / 100,
    received: Math.round(received * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    totalShared: Math.round(totalShared * 100) / 100,
    currency: 'EUR',
    partnerEmail,
  })
}
