import { buildSharedExpenseEmailHtml, buildSharedExpenseRemovalEmailHtml } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MOCK_EXPENSE = {
  myEmail:       'gabriele@example.com',
  partnerEmail:  'wife@example.com',
  myName:        'Gabriele',
  partnerName:   'Sofia',
  amount:        124.50,
  description:   'Cena al ristorante',
  category:      'Ristoranti',
  date:          '2026-06-07',
  payerEmail:    'gabriele@example.com',
  otherShare:    0.5,
  notes:         'Compleanno di Sofia 🎂',
  runningBalance: 62.25,
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'expense'
  const recipient = req.nextUrl.searchParams.get('recipient') ?? 'me'
  const recipientEmail = recipient === 'partner' ? MOCK_EXPENSE.partnerEmail : MOCK_EXPENSE.myEmail

  let html: string
  if (type === 'removal') {
    html = buildSharedExpenseRemovalEmailHtml({ ...MOCK_EXPENSE, removedByEmail: MOCK_EXPENSE.myEmail }, recipientEmail)
  } else {
    html = buildSharedExpenseEmailHtml(MOCK_EXPENSE, recipientEmail)
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
