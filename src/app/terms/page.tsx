export const metadata = { title: 'Terms of Use – Ledgernest' }

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#e6edf3' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Use</h1>
      <p style={{ color: '#8b949e', marginBottom: 40 }}>Last updated: May 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Scope</h2>
        <p>
          Ledgernest is a private personal finance application operated exclusively for the
          personal use of its owner. Access is restricted to authorised users only.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. Open Banking access</h2>
        <p>
          By initiating a bank connection, the user explicitly consents to Ledgernest
          requesting read-only access to their bank account data via the Enable Banking API
          under PSD2. This access is limited to account information and transaction history
          and does not include payment initiation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. Liability</h2>
        <p>
          Ledgernest is provided as-is for personal use. The owner makes no warranties
          regarding availability, accuracy of financial data, or fitness for any particular purpose.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Contact</h2>
        <p>
          <a href="mailto:mandalari.gabriele@gmail.com" style={{ color: '#5bc8d0' }}>
            mandalari.gabriele@gmail.com
          </a>
        </p>
      </section>
    </div>
  )
}
