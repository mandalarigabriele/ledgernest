import { Resend } from 'resend'

const FROM = 'LedgerNest <onboarding@resend.dev>'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function shortEmail(email: string) { return email.split('@')[0] }

function fmtAmount(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Light-theme palette
const C = {
  bgPage:    '#f6f8fa',
  bgCard:    '#ffffff',
  bgInner:   '#f6f8fa',
  border:    '#d0d7de',
  accent:    '#5bc8d0',
  accentDark:'#3aa8b0',
  success:   '#1a7f37',
  danger:    '#cf222e',
  textMain:  '#1f2328',
  textMuted: '#636c76',
  textLight: '#ffffff',
}

// ── Shared expense notification ───────────────────────────────────────────────

export interface SharedExpenseEmailParams {
  myEmail: string
  partnerEmail: string
  myName?: string
  partnerName?: string
  amount: number
  description: string
  category?: string | null
  date: string           // YYYY-MM-DD
  payerEmail: string
  otherShare: number     // fraction 0–1 that the non-payer owes
  notes?: string | null
  runningBalance?: number
  sendToMe?: boolean
  sendToPartner?: boolean
}

function resolveName(email: string, myEmail: string, partnerEmail: string, myName?: string, partnerName?: string): string {
  if (email === myEmail) return myName || shortEmail(email)
  if (email === partnerEmail) return partnerName || shortEmail(email)
  return shortEmail(email)
}

function buildSharedExpenseHtml(p: SharedExpenseEmailParams, recipientEmail: string): string {
  const myName      = p.myName      || shortEmail(p.myEmail)
  const partnerName = p.partnerName || shortEmail(p.partnerEmail)
  const payerName   = p.payerEmail === p.myEmail ? myName : partnerName
  const nonPayerName = p.payerEmail === p.myEmail ? partnerName : myName

  const iPaid       = p.payerEmail === recipientEmail
  const recipientName = recipientEmail === p.myEmail ? myName : partnerName
  const myShare     = iPaid ? p.amount * (1 - p.otherShare) : p.amount * p.otherShare
  const theirShare  = p.amount - myShare

  const balanceAmt   = iPaid ? theirShare : myShare
  const balanceColor = iPaid ? C.success : C.danger
  const balanceSign  = iPaid ? '+' : '−'
  const balanceLabel = iPaid
    ? `Hai anticipato la quota di <strong>${nonPayerName}</strong>`
    : `Devi a <strong>${payerName}</strong> la tua quota`

  let runningSection = ''
  if (p.runningBalance !== undefined) {
    const recipientBalance = recipientEmail === p.myEmail ? p.runningBalance : -p.runningBalance
    const otherName = recipientEmail === p.myEmail ? partnerName : myName
    const isOwed  = recipientBalance > 0.005
    const isOwing = recipientBalance < -0.005
    const absTotal = Math.abs(recipientBalance)
    const totalColor = isOwed ? C.success : isOwing ? C.danger : C.textMuted
    const totalLabel = isOwed
      ? `<strong>${otherName}</strong> ti deve in totale`
      : isOwing
      ? `Devi in totale a <strong>${otherName}</strong>`
      : 'Siete in pari ✓'
    const totalValue = (isOwed || isOwing) ? fmtAmount(absTotal) : ''

    runningSection = `
      <tr><td style="height:1px;background:${C.border};padding:0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:20px 28px 24px;">
          <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:16px 18px;">
            <div style="font-size:10px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
              Saldo complessivo aggiornato
            </div>
            <div style="font-size:13px;color:${C.textMuted};margin-bottom:6px;">${totalLabel}</div>
            ${totalValue ? `<div style="font-size:24px;font-weight:800;color:${totalColor};letter-spacing:-0.5px;">${totalValue}</div>` : `<div style="font-size:16px;font-weight:700;color:${totalColor};">${totalLabel}</div>`}
          </div>
        </td>
      </tr>`
  }

  const notesSection = p.notes ? `
      <tr>
        <td style="padding:0 28px 20px;">
          <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:12px 16px;">
            <div style="font-size:10px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Note</div>
            <div style="font-size:13px;color:${C.textMain};">${p.notes}</div>
          </div>
        </td>
      </tr>` : ''

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nuova spesa condivisa · LedgerNest</title>
</head>
<body style="margin:0;padding:0;background:${C.bgPage};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgPage};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:${C.textMain};letter-spacing:-0.5px;">
                Ledger<span style="color:${C.accent};">Nest</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${C.bgCard};border:1px solid ${C.border};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Header band -->
                <tr>
                  <td style="background:${C.accent};padding:20px 28px;">
                    <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Nuova spesa condivisa</div>
                    <div style="font-size:30px;font-weight:800;color:${C.textMain};letter-spacing:-1px;">${fmtAmount(p.amount)}</div>
                  </td>
                </tr>

                <!-- Description + date -->
                <tr>
                  <td style="padding:24px 28px 0;">
                    <div style="font-size:19px;font-weight:700;color:${C.textMain};margin-bottom:6px;">${p.description}</div>
                    <div style="font-size:13px;color:${C.textMuted};">
                      ${p.category ? `<span style="display:inline-block;background:${C.bgInner};border:1px solid ${C.border};border-radius:20px;padding:2px 10px;font-size:12px;margin-right:8px;">${p.category}</span>` : ''}
                      ${fmtDate(p.date)}
                    </div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr><td style="padding:20px 28px 0;"><div style="height:1px;background:${C.border};"></div></td></tr>

                <!-- Split table -->
                <tr>
                  <td style="padding:20px 28px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-right:6px;vertical-align:top;">
                          <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;">
                            <div style="font-size:10px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${payerName} · ha pagato</div>
                            <div style="font-size:18px;font-weight:800;color:${C.success};">${fmtAmount(p.amount)}</div>
                          </div>
                        </td>
                        <td width="50%" style="padding-left:6px;vertical-align:top;">
                          <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;">
                            <div style="font-size:10px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${nonPayerName} · quota</div>
                            <div style="font-size:18px;font-weight:800;color:${C.danger};">${fmtAmount(p.payerEmail === p.myEmail ? theirShare : myShare)}</div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Per-recipient balance row -->
                <tr>
                  <td style="padding:16px 28px 0;">
                    <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:14px 18px;">
                      <div style="font-size:10px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">La tua quota, ${recipientName}</div>
                      <div style="font-size:26px;font-weight:800;color:${balanceColor};letter-spacing:-0.5px;margin-bottom:4px;">${balanceSign}${fmtAmount(balanceAmt)}</div>
                      <div style="font-size:13px;color:${C.textMuted};">${balanceLabel}</div>
                    </div>
                  </td>
                </tr>

                ${notesSection}

                ${runningSection}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <div style="font-size:12px;color:${C.textMuted};">
                Inviato da <strong style="color:${C.textMain};">LedgerNest</strong> · Gestione spese condivise
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

// ── Removal notification ──────────────────────────────────────────────────────

export interface SharedExpenseRemovalEmailParams {
  myEmail: string
  partnerEmail: string
  myName?: string
  partnerName?: string
  amount: number
  description: string
  category?: string | null
  date: string
  removedByEmail: string
  sendToMe?: boolean
  sendToPartner?: boolean
}

function buildRemovalHtml(p: SharedExpenseRemovalEmailParams, recipientEmail: string): string {
  const myName      = p.myName      || shortEmail(p.myEmail)
  const partnerName = p.partnerName || shortEmail(p.partnerEmail)
  const removedByName = resolveName(p.removedByEmail, p.myEmail, p.partnerEmail, myName, partnerName)

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Spesa condivisa rimossa · LedgerNest</title>
</head>
<body style="margin:0;padding:0;background:${C.bgPage};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgPage};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:${C.textMain};letter-spacing:-0.5px;">
                Ledger<span style="color:${C.accent};">Nest</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${C.bgCard};border:1px solid ${C.border};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Header band -->
                <tr>
                  <td style="background:#ffd8d8;border-bottom:1px solid #f5c6c6;padding:20px 28px;">
                    <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.45);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Spesa condivisa rimossa</div>
                    <div style="font-size:30px;font-weight:800;color:${C.danger};letter-spacing:-1px;">${fmtAmount(p.amount)}</div>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:24px 28px;">
                    <div style="font-size:18px;font-weight:700;color:${C.textMain};margin-bottom:6px;">${p.description}</div>
                    <div style="font-size:13px;color:${C.textMuted};margin-bottom:20px;">
                      ${p.category ? `<span style="display:inline-block;background:${C.bgInner};border:1px solid ${C.border};border-radius:20px;padding:2px 10px;font-size:12px;margin-right:8px;">${p.category}</span>` : ''}
                      ${fmtDate(p.date)}
                    </div>
                    <div style="background:${C.bgInner};border:1px solid ${C.border};border-radius:10px;padding:14px 18px;font-size:13px;color:${C.textMuted};">
                      Rimossa da <strong style="color:${C.textMain};">${removedByName}</strong>. Questa spesa non contribuisce più al saldo.
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <div style="font-size:12px;color:${C.textMuted};">
                Inviato da <strong style="color:${C.textMain};">LedgerNest</strong> · Gestione spese condivise
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

// ── Send functions ────────────────────────────────────────────────────────────

export async function sendSharedExpenseNotification(p: SharedExpenseEmailParams): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const sendToMe      = p.sendToMe      !== false
  const sendToPartner = p.sendToPartner !== false
  if (!sendToMe && !sendToPartner) return

  const payerName = resolveName(p.payerEmail, p.myEmail, p.partnerEmail, p.myName, p.partnerName)
  const subject   = `🤝 ${payerName} ha aggiunto una spesa condivisa · ${fmtAmount(p.amount)}`

  const sends: Promise<unknown>[] = []
  if (sendToMe)
    sends.push(resend.emails.send({ from: FROM, to: p.myEmail,      subject, html: buildSharedExpenseHtml(p, p.myEmail) }))
  if (sendToPartner)
    sends.push(resend.emails.send({ from: FROM, to: p.partnerEmail, subject, html: buildSharedExpenseHtml(p, p.partnerEmail) }))

  try { await Promise.all(sends) }
  catch (err) { console.error('[email] sendSharedExpenseNotification failed:', err) }
}

export async function sendSharedExpenseRemovalNotification(p: SharedExpenseRemovalEmailParams): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const sendToMe      = p.sendToMe      !== false
  const sendToPartner = p.sendToPartner !== false
  if (!sendToMe && !sendToPartner) return

  const removedByName = resolveName(p.removedByEmail, p.myEmail, p.partnerEmail, p.myName, p.partnerName)
  const subject = `🗑 ${removedByName} ha rimosso una spesa condivisa · ${fmtAmount(p.amount)}`

  const sends: Promise<unknown>[] = []
  if (sendToMe)
    sends.push(resend.emails.send({ from: FROM, to: p.myEmail,      subject, html: buildRemovalHtml(p, p.myEmail) }))
  if (sendToPartner)
    sends.push(resend.emails.send({ from: FROM, to: p.partnerEmail, subject, html: buildRemovalHtml(p, p.partnerEmail) }))

  try { await Promise.all(sends) }
  catch (err) { console.error('[email] sendSharedExpenseRemovalNotification failed:', err) }
}
