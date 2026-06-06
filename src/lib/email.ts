import { Resend } from 'resend'

const FROM = 'LedgerNest <onboarding@resend.dev>'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function shortEmail(email: string) {
  return email.split('@')[0]
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Shared expense notification ───────────────────────────────────────────────

export interface SharedExpenseEmailParams {
  myEmail: string        // creator / logged-in user
  partnerEmail: string
  amount: number
  description: string
  category?: string | null
  date: string           // YYYY-MM-DD
  payerEmail: string
  otherShare: number     // fraction 0–1 that the non-payer owes
  notes?: string | null
  // Running balance (positive = myEmail is owed by partner, negative = myEmail owes partner)
  runningBalance?: number
  sendToMe?: boolean      // default true
  sendToPartner?: boolean // default true
}

function buildSharedExpenseHtml(p: SharedExpenseEmailParams, recipientEmail: string): string {
  const myName      = shortEmail(p.myEmail)
  const partnerName = shortEmail(p.partnerEmail)

  const payerName   = p.payerEmail === p.myEmail ? myName : partnerName
  const iPaid       = p.payerEmail === recipientEmail
  const myShare     = iPaid
    ? p.amount * (1 - p.otherShare)
    : p.amount * p.otherShare
  const theirShare  = p.amount - myShare

  const balanceText = iPaid
    ? `Ti verranno rimborsati <strong>${fmtAmount(theirShare)}</strong>`
    : `Devi <strong>${fmtAmount(myShare)}</strong> a ${payerName}`

  const accentColor  = '#5bc8d0'
  const successColor = '#3fb950'
  const dangerColor  = '#f85149'
  const bgPage       = '#0d1117'
  const bgCard       = '#161b22'
  const bgInner      = '#1c2128'
  const borderColor  = '#30363d'
  const textPrimary  = '#e6edf3'
  const textMuted    = '#8b949e'

  const balanceColor = iPaid ? successColor : dangerColor
  const balanceSign  = iPaid ? '+' : '−'

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nuova spesa condivisa · LedgerNest</title>
</head>
<body style="margin:0;padding:0;background:${bgPage};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgPage};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:800;color:${textPrimary};letter-spacing:-0.5px;">
                  Ledger<span style="color:${accentColor};">Nest</span>
                </span>
              </div>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:${bgCard};border:1px solid ${borderColor};border-radius:16px;overflow:hidden;">

              <!-- Card header band -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${accentColor};padding:20px 28px;">
                    <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.55);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
                      Nuova spesa condivisa
                    </div>
                    <div style="font-size:28px;font-weight:800;color:#0d1117;letter-spacing:-0.5px;">
                      ${fmtAmount(p.amount)}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 28px;">

                <!-- Description -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <div style="font-size:19px;font-weight:700;color:${textPrimary};margin-bottom:6px;">
                      ${p.description}
                    </div>
                    <div style="font-size:13px;color:${textMuted};">
                      ${p.category ? `<span style="display:inline-block;background:${bgInner};border:1px solid ${borderColor};border-radius:20px;padding:3px 10px;margin-right:8px;font-size:12px;">${p.category}</span>` : ''}
                      ${fmtDate(p.date)}
                    </div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr><td style="height:1px;background:${borderColor};padding:0;margin:0 0 20px;"></td></tr>

                <!-- Split detail table -->
                <tr>
                  <td style="padding:16px 0 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Payer column -->
                        <td width="50%" style="padding-right:8px;vertical-align:top;">
                          <div style="background:${bgInner};border:1px solid ${borderColor};border-radius:12px;padding:14px 16px;">
                            <div style="font-size:10px;font-weight:700;color:${textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
                              ${p.payerEmail === p.myEmail ? myName : partnerName} · ha pagato
                            </div>
                            <div style="font-size:18px;font-weight:800;color:${successColor};">
                              ${fmtAmount(p.amount)}
                            </div>
                          </div>
                        </td>
                        <!-- Non-payer column -->
                        <td width="50%" style="padding-left:8px;vertical-align:top;">
                          <div style="background:${bgInner};border:1px solid ${borderColor};border-radius:12px;padding:14px 16px;">
                            <div style="font-size:10px;font-weight:700;color:${textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
                              ${p.payerEmail === p.myEmail ? partnerName : myName} · quota
                            </div>
                            <div style="font-size:18px;font-weight:800;color:${dangerColor};">
                              ${fmtAmount(p.payerEmail === p.myEmail ? theirShare : myShare)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Balance line for recipient -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <div style="background:${bgInner};border:1px solid ${borderColor};border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;font-weight:800;color:${balanceColor};">
                        ${balanceSign}${fmtAmount(iPaid ? theirShare : myShare)}
                      </span>
                      <span style="font-size:13px;color:${textMuted};">
                        ${balanceText}
                      </span>
                    </div>
                  </td>
                </tr>

                ${p.notes ? `
                <!-- Notes -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <div style="background:${bgInner};border:1px solid ${borderColor};border-radius:10px;padding:12px 16px;">
                      <div style="font-size:11px;font-weight:700;color:${textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Note</div>
                      <div style="font-size:13px;color:${textPrimary};">${p.notes}</div>
                    </div>
                  </td>
                </tr>` : ''}

                ${p.runningBalance !== undefined ? (() => {
                  // Compute running balance from recipient's perspective
                  const recipientBalance = recipientEmail === p.myEmail
                    ? p.runningBalance
                    : -p.runningBalance!
                  const isOwed   = recipientBalance > 0.005
                  const isOwing  = recipientBalance < -0.005
                  const absTotal = Math.abs(recipientBalance)
                  const totalColor  = isOwed ? successColor : isOwing ? dangerColor : textMuted
                  const totalLabel  = isOwed
                    ? `${shortEmail(recipientEmail === p.myEmail ? p.partnerEmail : p.myEmail)} ti deve in totale`
                    : isOwing
                    ? `Devi in totale a ${shortEmail(recipientEmail === p.myEmail ? p.partnerEmail : p.myEmail)}`
                    : 'Siete in pari'
                  return `
                <!-- Running balance -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <div style="background:${bgInner};border:1px solid ${borderColor};border-radius:12px;padding:16px 18px;">
                      <div style="font-size:10px;font-weight:700;color:${textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
                        Saldo complessivo
                      </div>
                      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                        <div style="font-size:13px;color:${textMuted};">${totalLabel}</div>
                        <div style="font-size:22px;font-weight:800;color:${totalColor};">${isOwed || isOwing ? fmtAmount(absTotal) : '✓ Pari'}</div>
                      </div>
                    </div>
                  </td>
                </tr>`
                })() : ''}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px;text-align:center;">
              <div style="font-size:12px;color:${textMuted};">
                Inviato da <strong style="color:${textPrimary};">LedgerNest</strong> · Gestione spese condivise
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendSharedExpenseNotification(p: SharedExpenseEmailParams): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const sendToMe      = p.sendToMe      !== false
  const sendToPartner = p.sendToPartner !== false
  if (!sendToMe && !sendToPartner) return

  const payerName = shortEmail(p.payerEmail)
  const subject   = `🤝 ${payerName} ha aggiunto una spesa condivisa · ${fmtAmount(p.amount)}`

  const sends: Promise<unknown>[] = []
  if (sendToMe)
    sends.push(resend.emails.send({ from: FROM, to: p.myEmail,      subject, html: buildSharedExpenseHtml(p, p.myEmail) }))
  if (sendToPartner)
    sends.push(resend.emails.send({ from: FROM, to: p.partnerEmail, subject, html: buildSharedExpenseHtml(p, p.partnerEmail) }))

  try {
    await Promise.all(sends)
  } catch (err) {
    console.error('[email] sendSharedExpenseNotification failed:', err)
  }
}
