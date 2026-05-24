import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Data comes from client-side stores; this route just wraps it for download
  const body = await req.json()
  const format = req.nextUrl.searchParams.get('format') ?? 'json'

  if (format === 'json') {
    return new NextResponse(JSON.stringify({ ...body, exportedAt: new Date().toISOString(), version: '1.0' }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ledgernest-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  }

  // CSV export of transactions
  if (format === 'csv') {
    const transactions = body.transactions ?? []
    const header = 'date,description,amount,type,category,account\n'
    const rows = transactions
      .map((t: Record<string, unknown>) =>
        `"${t.date}","${t.description}","${t.amount}","${t.type}","${t.category}","${t.accountId}"`
      )
      .join('\n')
    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ledgernest-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
}
