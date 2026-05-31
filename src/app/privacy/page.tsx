export const metadata = { title: 'Privacy Policy – Ledgernest' }

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#e6edf3' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#8b949e', marginBottom: 40 }}>Last updated: May 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>1. Overview</h2>
        <p>
          Ledgernest is a personal finance dashboard operated for private use by its owner.
          It is not a public service and does not collect data from third parties beyond what
          is strictly necessary to provide its functionality to the authorised user.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>2. Data collected</h2>
        <p>Ledgernest may process the following categories of data:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Google account identity (name, email) — for authentication only</li>
          <li>Bank account information and transaction history — fetched via Open Banking (PSD2) on explicit user request</li>
          <li>Manually entered financial data (accounts, transactions, budget, portfolio)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>3. How data is used</h2>
        <p>
          All data is stored locally on the server operated by the owner and is used exclusively
          to display personal financial dashboards. No data is sold, shared, or transmitted to
          third parties, except to Enable Banking S.A. for the purpose of Open Banking
          account access authorisation under PSD2.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>4. Open Banking (PSD2)</h2>
        <p>
          When the user initiates a bank connection, Ledgernest uses the Enable Banking API
          (Enable Banking S.A., Luxembourg) to obtain read-only access to account information
          and transactions. Access is granted solely by the account owner via the bank&apos;s
          own authentication interface and can be revoked at any time through the bank or
          through the Enable Banking consent dashboard.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>5. Data retention</h2>
        <p>
          Data is retained for as long as the application is in use. The owner may delete all
          data at any time by resetting the local database.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>6. Contact</h2>
        <p>
          For any privacy-related question, contact the application owner at{' '}
          <a href="mailto:mandalari.gabriele@gmail.com" style={{ color: '#5bc8d0' }}>
            mandalari.gabriele@gmail.com
          </a>.
        </p>
      </section>
    </div>
  )
}
