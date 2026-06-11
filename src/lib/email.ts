import { Resend } from 'resend'

const FROM = 'LedgerNest <noreply@ledgernest.mandalarigabriele.com>'

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

const LOGO_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSIxMCIgZmlsbD0iIzViYzhkMCIvPjxyZWN0IHg9IjYiIHk9IjYiIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgcng9IjciIGZpbGw9IiMwYjBmMTIiLz48cGF0aCBkPSJNMTAgMjdsNy0xMCA1IDYgNC01IDYgOSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg=='

function logoHtml(): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="padding-right:10px;vertical-align:middle;">
          <img src="${LOGO_DATA_URI}" width="40" height="40" alt="LedgerNest" style="display:block;border-radius:10px;" />
        </td>
        <td style="vertical-align:middle;font-size:21px;font-weight:800;color:#1f2328;letter-spacing:-0.3px;">LedgerNest</td>
      </tr>
    </table>
    <div style="font-size:12px;color:#8a9199;margin-top:5px;">Gestione spese condivise</div>`
}

function footerHtml(): string {
  return `
    <td align="center" style="padding:28px 0 0;">
      ${logoHtml()}
      <div style="height:1px;background:#dde1e5;margin:16px auto;max-width:260px;"></div>
      <div style="font-size:11px;color:#adb5bd;">Questa email è stata inviata automaticamente, non rispondere.</div>
    </td>`
}

export function buildSharedExpenseEmailHtml(p: SharedExpenseEmailParams, recipientEmail: string): string {
  const myName       = p.myName      || shortEmail(p.myEmail)
  const partnerName  = p.partnerName || shortEmail(p.partnerEmail)
  const payerName    = p.payerEmail === p.myEmail ? myName : partnerName
  const nonPayerName = p.payerEmail === p.myEmail ? partnerName : myName

  const iPaid         = p.payerEmail === recipientEmail
  const nonPayerShare = Math.round(p.amount * p.otherShare * 100) / 100
  const balanceAmt    = nonPayerShare
  const balanceColor  = iPaid ? C.success : C.danger
  const balanceSign   = iPaid ? '+' : '−'
  const balanceLabel  = iPaid
    ? `Hai coperto la quota di <strong style="color:${C.textMain};">${nonPayerName}</strong>`
    : `Devi rimborsare <strong style="color:${C.textMain};">${payerName}</strong>`

  let runningSectionHtml = ''
  if (p.runningBalance !== undefined) {
    const recipientBalance = recipientEmail === p.myEmail ? p.runningBalance : -p.runningBalance
    const otherName = recipientEmail === p.myEmail ? partnerName : myName
    const isOwed  = recipientBalance > 0.005
    const isOwing = recipientBalance < -0.005
    const totalColor = isOwed ? C.success : isOwing ? C.danger : '#3aa8b0'
    const totalLabel = isOwed
      ? `${otherName} ti deve`
      : isOwing
      ? `Devi a ${otherName}`
      : 'Siete in pari'
    const totalValue = (isOwed || isOwing) ? fmtAmount(Math.abs(recipientBalance)) : '✓'

    runningSectionHtml = `
          <!-- Running balance -->
          <tr>
            <td style="padding:16px 0 0;">
              <div style="background:#f0fbfa;border:1.5px solid #ade4df;border-radius:14px;padding:22px 24px;text-align:center;">
                <div style="font-size:11px;font-weight:700;color:#3aa8b0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Saldo aggiornato</div>
                <div style="font-size:15px;color:${C.textMain};margin-bottom:10px;">${totalLabel}</div>
                <div style="font-size:36px;font-weight:800;color:${totalColor};letter-spacing:-1.5px;line-height:1;">${totalValue}</div>
              </div>
            </td>
          </tr>`
  }

  const notesHtml = p.notes ? `
          <tr>
            <td style="padding:16px 0 0;">
              <div style="background:#f6f8fa;border:1px solid #d0d7de;border-radius:10px;padding:14px 16px;">
                <div style="font-size:10px;font-weight:700;color:#636c76;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Note</div>
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
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Top logo -->
          <tr>
            <td align="center" style="padding-bottom:22px;">
              ${logoHtml()}
            </td>
          </tr>

          <!-- Hero gradient card -->
          <tr>
            <td style="background:linear-gradient(135deg,#5bc8d0 0%,#33b49a 100%);border-radius:18px;padding:26px 28px 26px;overflow:hidden;">
              <!-- Badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:rgba(0,0,0,0.18);border-radius:20px;padding:5px 14px;">
                    <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.95);text-transform:uppercase;letter-spacing:0.08em;">🧾 Nuova spesa condivisa</span>
                  </td>
                </tr>
              </table>
              <!-- Amount -->
              <div style="font-size:40px;font-weight:800;color:#ffffff;letter-spacing:-2px;line-height:1;margin-bottom:10px;">${fmtAmount(p.amount)}</div>
              <!-- Description -->
              <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.95);margin-bottom:16px;">${p.description}</div>
              <!-- Category + date -->
              ${p.category ? `<div style="margin-bottom:8px;"><span style="background:rgba(255,255,255,0.22);border-radius:20px;padding:4px 12px;font-size:12px;color:rgba(255,255,255,0.92);">🏷 ${p.category}</span></div>` : ''}
              <div style="font-size:13px;color:rgba(255,255,255,0.85);">📅 ${fmtDate(p.date)}</div>
            </td>
          </tr>

          <!-- Two person cards -->
          <tr>
            <td style="padding:16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" valign="top" style="background:#ffffff;border:1px solid #e2e6ea;border-radius:14px;padding:18px 16px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:#e4f7f6;margin-bottom:12px;text-align:center;line-height:44px;font-size:22px;">👤</div>
                    <div style="font-size:10px;font-weight:700;color:#3aa8b0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Ha pagato</div>
                    <div style="font-size:14px;font-weight:700;color:#1f2328;margin-bottom:8px;">${payerName}</div>
                    <div style="font-size:22px;font-weight:800;color:${C.success};">${fmtAmount(p.amount)}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" valign="top" style="background:#ffffff;border:1px solid #e2e6ea;border-radius:14px;padding:18px 16px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:#e8f0fb;margin-bottom:12px;text-align:center;line-height:44px;font-size:22px;">👥</div>
                    <div style="font-size:10px;font-weight:700;color:#6c88c4;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Quota di</div>
                    <div style="font-size:14px;font-weight:700;color:#1f2328;margin-bottom:8px;">${nonPayerName}</div>
                    <div style="font-size:22px;font-weight:800;color:${C.danger};">${fmtAmount(nonPayerShare)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personal balance -->
          <tr>
            <td style="padding:16px 0 0;">
              <div style="background:#e6f9f5;border:1.5px solid #ade4df;border-radius:14px;padding:20px 22px;">
                <div style="font-size:10px;font-weight:700;color:#3aa8b0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${iPaid ? 'Hai anticipato' : 'La tua quota'}</div>
                <div style="font-size:32px;font-weight:800;color:${balanceColor};letter-spacing:-1px;margin-bottom:8px;">${balanceSign}${fmtAmount(balanceAmt)}</div>
                <div style="font-size:13px;color:#636c76;">${balanceLabel}</div>
              </div>
            </td>
          </tr>

          ${notesHtml}

          ${runningSectionHtml}

          <!-- Footer -->
          <tr>
            ${footerHtml()}
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

export function buildSharedExpenseRemovalEmailHtml(p: SharedExpenseRemovalEmailParams, _recipientEmail: string): string {
  const myName        = p.myName      || shortEmail(p.myEmail)
  const partnerName   = p.partnerName || shortEmail(p.partnerEmail)
  const removedByName = resolveName(p.removedByEmail, p.myEmail, p.partnerEmail, myName, partnerName)

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Spesa condivisa rimossa · LedgerNest</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Top logo -->
          <tr>
            <td align="center" style="padding-bottom:22px;">
              ${logoHtml()}
            </td>
          </tr>

          <!-- Hero gradient card (red) -->
          <tr>
            <td style="background:linear-gradient(135deg,#e57373 0%,#c0392b 100%);border-radius:18px;padding:26px 28px;overflow:hidden;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:rgba(0,0,0,0.18);border-radius:20px;padding:5px 14px;">
                    <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.95);text-transform:uppercase;letter-spacing:0.08em;">🗑 Spesa condivisa rimossa</span>
                  </td>
                </tr>
              </table>
              <div style="font-size:40px;font-weight:800;color:#ffffff;letter-spacing:-2px;line-height:1;margin-bottom:10px;">${fmtAmount(p.amount)}</div>
              <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.95);margin-bottom:16px;">${p.description}</div>
              ${p.category ? `<div style="margin-bottom:8px;"><span style="background:rgba(255,255,255,0.22);border-radius:20px;padding:4px 12px;font-size:12px;color:rgba(255,255,255,0.92);">🏷 ${p.category}</span></div>` : ''}
              <div style="font-size:13px;color:rgba(255,255,255,0.85);">📅 ${fmtDate(p.date)}</div>
            </td>
          </tr>

          <!-- Info box -->
          <tr>
            <td style="padding:16px 0 0;">
              <div style="background:#fff5f5;border:1.5px solid #f5c6c6;border-radius:14px;padding:20px 22px;">
                <div style="font-size:10px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">❌ Spesa rimossa</div>
                <div style="font-size:14px;color:#636c76;">
                  Rimossa da <strong style="color:#1f2328;">${removedByName}</strong>.
                  Questa spesa non contribuisce più al saldo complessivo.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            ${footerHtml()}
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
  const subject   = `🤝 ${fmtAmount(p.amount)} · ${payerName} ha aggiunto una spesa condivisa`

  const sends: Promise<unknown>[] = []
  if (sendToMe)
    sends.push(resend.emails.send({ from: FROM, to: p.myEmail,      subject, html: buildSharedExpenseEmailHtml(p, p.myEmail) }))
  if (sendToPartner)
    sends.push(resend.emails.send({ from: FROM, to: p.partnerEmail, subject, html: buildSharedExpenseEmailHtml(p, p.partnerEmail) }))

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
  const subject = `🗑 ${fmtAmount(p.amount)} · ${removedByName} ha rimosso una spesa condivisa`

  const sends: Promise<unknown>[] = []
  if (sendToMe)
    sends.push(resend.emails.send({ from: FROM, to: p.myEmail,      subject, html: buildSharedExpenseRemovalEmailHtml(p, p.myEmail) }))
  if (sendToPartner)
    sends.push(resend.emails.send({ from: FROM, to: p.partnerEmail, subject, html: buildSharedExpenseRemovalEmailHtml(p, p.partnerEmail) }))

  try { await Promise.all(sends) }
  catch (err) { console.error('[email] sendSharedExpenseRemovalNotification failed:', err) }
}
