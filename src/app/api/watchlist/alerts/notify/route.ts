import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const to      = session?.user?.email
  if (!to) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  const { ticker, threshold, direction, price } = await req.json() as {
    ticker: string; threshold: number; direction: 'above' | 'below'; price: number
  }

  const arrow = direction === 'above' ? '↑' : '↓'
  const label = direction === 'above' ? 'superato' : 'sceso sotto'

  try {
    await resend.emails.send({
      from:    'LedgerNest Alerts <onboarding@resend.dev>',
      to,
      subject: `🔔 Alert: ${ticker} ${arrow} ${threshold}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Alert prezzo attivato</h2>
          <p style="color:#666;margin:0 0 24px">Il tuo alert per <strong>${ticker}</strong> si è attivato.</p>

          <div style="background:#f5f5f5;border-radius:10px;padding:20px;margin-bottom:24px">
            <div style="font-size:28px;font-weight:800;margin-bottom:4px">${price.toLocaleString('it', { minimumFractionDigits: 2 })}</div>
            <div style="color:#666;font-size:14px">${ticker} ha ${label} la soglia di <strong>${threshold.toLocaleString('it', { minimumFractionDigits: 2 })}</strong></div>
          </div>

          <p style="color:#999;font-size:12px">LedgerNest · Alert automatico</p>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'mail failed' }, { status: 500 })
  }
}
