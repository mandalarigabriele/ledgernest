import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioSnapshotStore, type PortfolioSnapshot } from '@/stores/portfolioSnapshotStore'
import { useSettingsStore } from '@/stores/settingsStore'

// ── deterministic pseudo-random ───────────────────────────────────────────────

function pr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// ── date helpers ─────────────────────────────────────────────────────────────

function msAgo(days: number): number { return Date.now() - days * 86_400_000 }
function dateAgo(days: number): string { return new Date(msAgo(days)).toISOString().slice(0, 10) }
function dateAt(monthsAgo: number, day?: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - monthsAgo); if (day) d.setDate(day); return d.toISOString().slice(0, 10)
}

// ── portfolio snapshot generator ─────────────────────────────────────────────

function buildSnapshots(): PortfolioSnapshot[] {
  const snaps: PortfolioSnapshot[] = []
  const DAYS = 540 // 18 months

  // Cumulative EUR invested as purchases happen (corrected for quantity=0 addPosition approach)
  // day 540: VWCE 7×104.5 + BTC 0.03×34000/1.09          ≈ 732 + 936  = 1668
  // day 480: + ENI 100×14.2                               + 1420 → 3088
  // day 420: + AAPL 5×158.2/1.09                          + 726  → 3814
  // day 330: + MSFT 2×285/1.09 + CSPX 4×505/1.09          + 2380 → 6194
  // day 300: + ENEL 200×6.1                               + 1220 → 7414
  // day 270: + VWCE 5×113.2                               + 566  → 7980
  // day 240: + AAPL 3×176.4/1.09                          + 486  → 8466
  // day 210: + SGLD 20×31.5/1.09                          + 578  → 9044
  // day 180: + BTC 0.02×43000/1.09                        + 789  → 9833
  // day 150: + MSFT 1×300/1.09                            + 275  → 10108
  // day 120: + CSPX 2×548/1.09                            + 1006 → 11114

  const investMilestones: [number, number][] = [
    [540, 1668],
    [480, 3088],
    [420, 3814],
    [330, 6194],
    [300, 7414],
    [270, 7980],
    [240, 8466],
    [210, 9044],
    [180, 9833],
    [150, 10108],
    [120, 11114],
    [0,   11114],
  ]

  function investedAtDay(dAgo: number): number {
    for (let i = 0; i < investMilestones.length - 1; i++) {
      const [d1, v1] = investMilestones[i]
      const [d2, v2] = investMilestones[i + 1]
      if (dAgo <= d1 && dAgo >= d2) {
        const t = (d1 - dAgo) / (d1 - d2)
        return v1 + (v2 - v1) * t
      }
    }
    return 11114
  }

  // 28% annual return accounts for this portfolio's crypto + equity mix.
  // At day=0: 11114 × (1.28)^(540/365) ≈ 11114 × 1.44 ≈ 16,004 EUR
  // This should be within ±10% of the live price, keeping the end-of-chart
  // step invisible at normal zoom levels.
  const ANNUAL_RETURN = 0.28

  function snapAt(ts: number, dAgo: number, i: number): PortfolioSnapshot {
    const invested = investedAtDay(dAgo)
    const growthFactor = Math.pow(1 + ANNUAL_RETURN, (DAYS - dAgo) / 365)
    const noise = (pr(i * 3 + 1) - 0.5) * 0.04
    const cryptoSwing = dAgo < 200 ? (pr(i * 7 + 3) - 0.48) * 0.06 : 0
    const value = Math.max(invested, Math.round(invested * growthFactor * (1 + noise + cryptoSwing)))

    const etfShare    = 0.55 - 0.10 * (1 - dAgo / DAYS)
    const stockShare  = 0.10 + 0.30 * (1 - dAgo / DAYS)
    const cryptoShare = 0.25 - 0.10 * (1 - dAgo / DAYS)
    const commodShare = dAgo < 220 ? 0.06 : 0

    return {
      ts,
      value,
      invested: Math.round(invested),
      etf:       Math.round(value * etfShare),
      stocks:    Math.round(value * stockShare),
      crypto:    Math.round(value * cryptoShare),
      commodity: Math.round(value * commodShare),
    }
  }

  // Weekly for days 540→366 (old data, downsampled anyway)
  let i = 0
  for (let d = DAYS; d > 365; d -= 7) { snaps.push(snapAt(msAgo(d), d, i++)) }
  // Daily for days 365→2
  for (let d = 365; d >= 2; d--)      { snaps.push(snapAt(msAgo(d), d, i++)) }
  // Every 6h for the last 48h → enough for 1G view (8 points), no spike risk
  for (let h = 48; h >= 0; h -= 6)    { snaps.push(snapAt(Date.now() - h * 3_600_000, h / 24, i++)) }

  return snaps.sort((a, b) => a.ts - b.ts)
}

// ── main seed function ────────────────────────────────────────────────────────

export function seedDemoData() {
  const ps  = usePortfolioStore.getState()
  const fs  = useFinanceStore.getState()
  const ss  = useSettingsStore.getState()
  const pss = usePortfolioSnapshotStore.getState()

  // ── Settings ──────────────────────────────────────────────────────────────
  ss.updateSettings({
    currency: 'EUR',
    selfName: 'Demo User',
    demoMode: true,
    targetAllocation: { 'ETF': 60, 'Azioni': 25, 'Crypto': 10, 'Materie prime': 5 },
  })

  // ── Portfolio snapshots ───────────────────────────────────────────────────
  pss.hydrate({ snapshots: buildSnapshots() })

  // ── Accounts ─────────────────────────────────────────────────────────────
  fs.addAccount({ name: 'Fineco',          type: 'bank',   icon: 'conti',  balance: 3240, currency: 'EUR', broker: 'Fineco' })
  fs.addAccount({ name: 'Trade Republic',  type: 'broker', icon: 'azioni', balance: 480,  currency: 'EUR', broker: 'Trade Republic' })
  fs.addAccount({ name: 'Coinbase Wallet', type: 'crypto', icon: 'crypto', balance: 120,  currency: 'EUR', broker: 'Coinbase' })

  const bankId = useFinanceStore.getState().accounts.find(a => a.name === 'Fineco')!.id

  // ── Positions ─────────────────────────────────────────────────────────────
  // IMPORTANT: addPosition with quantity:0 — trades accumulate the correct qty+avgPrice.
  // Using non-zero qty here would double-count because addTrade(buy) adds on top.

  // Apple — 5 shares (day 420) + 3 shares (day 240) = 8 total
  ps.addPosition({ ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', quantity: 0, avgPrice: 0, currency: 'USD', broker: 'Trade Republic', sector: 'Technology', purchaseDate: dateAgo(420) })
  const appleId = usePortfolioStore.getState().positions.find(p => p.ticker === 'AAPL')!.id
  ps.addTrade({ positionId: appleId, ticker: 'AAPL', type: 'buy', quantity: 5, price: 158.20, commission: 0, date: dateAgo(420), currency: 'USD' })
  ps.addTrade({ positionId: appleId, ticker: 'AAPL', type: 'buy', quantity: 3, price: 176.40, commission: 0, date: dateAgo(240), currency: 'USD' })
  for (let q = 6; q >= 1; q--)
    ps.addDividend({ ticker: 'AAPL', positionId: appleId, amount: 0.25 * 8, payDate: dateAt(q * 3), exDate: dateAt(q * 3 + 1), currency: 'USD' })

  // Microsoft — 2 (day 330) + 1 (day 150) = 3 total
  ps.addPosition({ ticker: 'MSFT', name: 'Microsoft Corp.', type: 'stock', quantity: 0, avgPrice: 0, currency: 'USD', broker: 'Trade Republic', sector: 'Technology', purchaseDate: dateAgo(330) })
  const msftId = usePortfolioStore.getState().positions.find(p => p.ticker === 'MSFT')!.id
  ps.addTrade({ positionId: msftId, ticker: 'MSFT', type: 'buy', quantity: 2, price: 285.00, commission: 0, date: dateAgo(330), currency: 'USD' })
  ps.addTrade({ positionId: msftId, ticker: 'MSFT', type: 'buy', quantity: 1, price: 300.00, commission: 0, date: dateAgo(150), currency: 'USD' })
  for (let q = 5; q >= 1; q--)
    ps.addDividend({ ticker: 'MSFT', positionId: msftId, amount: 0.75 * 3, payDate: dateAt(q * 3), exDate: dateAt(q * 3 + 1), currency: 'USD' })

  // VWCE.DE — 7 (day 540) + 5 (day 270) = 12 total (accumulating, no dividends)
  ps.addPosition({ ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World ETF Acc', type: 'etf', quantity: 0, avgPrice: 0, currency: 'EUR', broker: 'Trade Republic', ter: 0.22, purchaseDate: dateAgo(540) })
  const vwceId = usePortfolioStore.getState().positions.find(p => p.ticker === 'VWCE.DE')!.id
  ps.addTrade({ positionId: vwceId, ticker: 'VWCE.DE', type: 'buy', quantity: 7, price: 104.50, commission: 0, date: dateAgo(540), currency: 'EUR' })
  ps.addTrade({ positionId: vwceId, ticker: 'VWCE.DE', type: 'buy', quantity: 5, price: 113.20, commission: 0, date: dateAgo(270), currency: 'EUR' })

  // CSPX.L — 4 (day 330) + 2 (day 120) = 6 total (accumulating, no dividends)
  ps.addPosition({ ticker: 'CSPX.L', name: 'iShares Core S&P 500 ETF Acc', type: 'etf', quantity: 0, avgPrice: 0, currency: 'USD', broker: 'Trade Republic', ter: 0.07, purchaseDate: dateAgo(330) })
  const cspxId = usePortfolioStore.getState().positions.find(p => p.ticker === 'CSPX.L')!.id
  ps.addTrade({ positionId: cspxId, ticker: 'CSPX.L', type: 'buy', quantity: 4, price: 505.00, commission: 0, date: dateAgo(330), currency: 'USD' })
  ps.addTrade({ positionId: cspxId, ticker: 'CSPX.L', type: 'buy', quantity: 2, price: 548.00, commission: 0, date: dateAgo(120), currency: 'USD' })

  // ENI.MI — 100 shares (day 480), semi-annual dividends
  ps.addPosition({ ticker: 'ENI.MI', name: 'Eni S.p.A.', type: 'stock', quantity: 0, avgPrice: 0, currency: 'EUR', broker: 'Trade Republic', sector: 'Energy', purchaseDate: dateAgo(480) })
  const eniId = usePortfolioStore.getState().positions.find(p => p.ticker === 'ENI.MI')!.id
  ps.addTrade({ positionId: eniId, ticker: 'ENI.MI', type: 'buy', quantity: 100, price: 14.20, commission: 1.00, date: dateAgo(480), currency: 'EUR' })
  for (let s = 3; s >= 1; s--) {
    ps.addDividend({ ticker: 'ENI.MI', positionId: eniId, amount: 0.43 * 100, payDate: dateAt(s * 6),     exDate: dateAt(s * 6 + 1),     currency: 'EUR' })
    ps.addDividend({ ticker: 'ENI.MI', positionId: eniId, amount: 0.47 * 100, payDate: dateAt(s * 6 - 3), exDate: dateAt(s * 6 - 3 + 1), currency: 'EUR' })
  }

  // Enel — 200 shares (day 300), semi-annual dividends
  ps.addPosition({ ticker: 'ENEL.MI', name: 'Enel S.p.A.', type: 'stock', quantity: 0, avgPrice: 0, currency: 'EUR', broker: 'Trade Republic', sector: 'Utilities', purchaseDate: dateAgo(300) })
  const enelId = usePortfolioStore.getState().positions.find(p => p.ticker === 'ENEL.MI')!.id
  ps.addTrade({ positionId: enelId, ticker: 'ENEL.MI', type: 'buy', quantity: 200, price: 6.10, commission: 1.50, date: dateAgo(300), currency: 'EUR' })
  for (let s = 2; s >= 1; s--) {
    ps.addDividend({ ticker: 'ENEL.MI', positionId: enelId, amount: 0.43 * 200, payDate: dateAt(s * 6),     exDate: dateAt(s * 6 + 1),     currency: 'EUR' })
    ps.addDividend({ ticker: 'ENEL.MI', positionId: enelId, amount: 0.23 * 200, payDate: dateAt(s * 6 - 3), exDate: dateAt(s * 6 - 3 + 1), currency: 'EUR' })
  }

  // Bitcoin — 0.03 (day 540) + 0.02 (day 180) = 0.05 total
  ps.addPosition({ ticker: 'BTC-USD', name: 'Bitcoin', type: 'crypto', quantity: 0, avgPrice: 0, currency: 'USD', broker: 'Coinbase', purchaseDate: dateAgo(540) })
  const btcId = usePortfolioStore.getState().positions.find(p => p.ticker === 'BTC-USD')!.id
  ps.addTrade({ positionId: btcId, ticker: 'BTC-USD', type: 'buy', quantity: 0.03, price: 34000, commission: 0, date: dateAgo(540), currency: 'USD' })
  ps.addTrade({ positionId: btcId, ticker: 'BTC-USD', type: 'buy', quantity: 0.02, price: 43000, commission: 0, date: dateAgo(180), currency: 'USD' })

  // Gold ETC — 20 shares (day 210)
  ps.addPosition({ ticker: 'SGLD.L', name: 'iShares Physical Gold ETC', type: 'commodity', quantity: 0, avgPrice: 0, currency: 'USD', broker: 'Trade Republic', purchaseDate: dateAgo(210) })
  const sgldId = usePortfolioStore.getState().positions.find(p => p.ticker === 'SGLD.L')!.id
  ps.addTrade({ positionId: sgldId, ticker: 'SGLD.L', type: 'buy', quantity: 20, price: 31.50, commission: 0, date: dateAgo(210), currency: 'USD' })

  void vwceId; void cspxId; void sgldId // referenced via broker name matching

  // ── Bank transactions (12 months) ────────────────────────────────────────

  const CAT = {
    stipendio:   'Stipendio',
    affitto:     'Casa',
    spesa:       'Alimentari',
    ristorante:  'Ristoranti',
    shopping:    'Shopping',
    abbonamenti: 'Abbonamenti',
    trasporti:   'Trasporti',
    utenze:      'Utenze',
    salute:      'Salute',
    viaggi:      'Viaggi',
  }

  for (let m = 0; m < 12; m++) {
    fs.addTransaction({ date: dateAt(m, 27), description: 'Accredito stipendio', amount: 2800,   type: 'income',  category: CAT.stipendio,   accountId: bankId })
    if (m % 3 === 0)
      fs.addTransaction({ date: dateAt(m, 15), description: 'Rimborso spese',   amount: 120,    type: 'income',  category: CAT.stipendio,   accountId: bankId })
    if (m === 11)
      fs.addTransaction({ date: dateAt(m, 20), description: '13ª mensilità',    amount: 2800,   type: 'income',  category: CAT.stipendio,   accountId: bankId })

    fs.addTransaction({ date: dateAt(m, 1),  description: 'Affitto',            amount: 950,    type: 'expense', category: CAT.affitto,     accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 4),  description: 'Enel Energia',       amount: m < 4 || m > 9 ? 110 : 68, type: 'expense', category: CAT.utenze, accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 5),  description: 'Fastweb Internet',   amount: 29.90,  type: 'expense', category: CAT.utenze,      accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 6),  description: 'Netflix',            amount: 13.99,  type: 'expense', category: CAT.abbonamenti, accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 6),  description: 'Spotify',            amount: 9.99,   type: 'expense', category: CAT.abbonamenti, accountId: bankId })
    if (m % 2 === 0)
      fs.addTransaction({ date: dateAt(m, 4), description: 'Telepass',          amount: 28,     type: 'expense', category: CAT.trasporti,   accountId: bankId })

    fs.addTransaction({ date: dateAt(m, 3),  description: 'Esselunga',          amount: 87 + Math.round(pr(m * 11) * 20), type: 'expense', category: CAT.spesa, accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 11), description: 'Carrefour',          amount: 74 + Math.round(pr(m * 13) * 18), type: 'expense', category: CAT.spesa, accountId: bankId })
    fs.addTransaction({ date: dateAt(m, 20), description: 'Esselunga',          amount: 91 + Math.round(pr(m * 7)  * 22), type: 'expense', category: CAT.spesa, accountId: bankId })
    if (m % 3 === 0)
      fs.addTransaction({ date: dateAt(m, 25), description: 'Lidl',             amount: 45,     type: 'expense', category: CAT.spesa,       accountId: bankId })

    fs.addTransaction({ date: dateAt(m, 10), description: 'Q8 Carburante',      amount: 65 + Math.round(pr(m * 5) * 20), type: 'expense', category: CAT.trasporti, accountId: bankId })
    if (m % 2 === 1)
      fs.addTransaction({ date: dateAt(m, 22), description: 'Trenitalia',       amount: 42,     type: 'expense', category: CAT.trasporti,   accountId: bankId })

    fs.addTransaction({ date: dateAt(m, 8),  description: 'Ristorante Da Mario',amount: 58,     type: 'expense', category: CAT.ristorante,  accountId: bankId })
    if (m % 2 === 0)
      fs.addTransaction({ date: dateAt(m, 17), description: 'Pizzeria Napoli',  amount: 36,     type: 'expense', category: CAT.ristorante,  accountId: bankId })
    if (m % 3 === 0)
      fs.addTransaction({ date: dateAt(m, 24), description: 'Sushi House',      amount: 48,     type: 'expense', category: CAT.ristorante,  accountId: bankId })

    if (m % 2 === 0)
      fs.addTransaction({ date: dateAt(m, 15), description: 'Amazon',           amount: 52,     type: 'expense', category: CAT.shopping,    accountId: bankId })
    if (m % 4 === 0)
      fs.addTransaction({ date: dateAt(m, 19), description: 'Zara',             amount: 89,     type: 'expense', category: CAT.shopping,    accountId: bankId })

    if (m % 2 === 1)
      fs.addTransaction({ date: dateAt(m, 14), description: 'Farmacia',         amount: 24,     type: 'expense', category: CAT.salute,      accountId: bankId })
    if (m % 6 === 0)
      fs.addTransaction({ date: dateAt(m, 9),  description: 'Medico curante',   amount: 50,     type: 'expense', category: CAT.salute,      accountId: bankId })
  }

  // ── One-off bigger events ─────────────────────────────────────────────────
  fs.addTransaction({ date: dateAgo(45),  description: 'Volo Roma-Barcellona', amount: 148,  type: 'expense', category: CAT.viaggi,     accountId: bankId })
  fs.addTransaction({ date: dateAgo(42),  description: 'Hotel Barcellona 3n',  amount: 320,  type: 'expense', category: CAT.viaggi,     accountId: bankId })
  fs.addTransaction({ date: dateAgo(20),  description: 'Bonus Q1',             amount: 500,  type: 'income',  category: CAT.stipendio,  accountId: bankId })
  fs.addTransaction({ date: dateAgo(90),  description: 'Apple MacBook Pro',    amount: 1899, type: 'expense', category: CAT.shopping,   accountId: bankId })
  fs.addTransaction({ date: dateAgo(200), description: 'Volo Milano-Londra',   amount: 112,  type: 'expense', category: CAT.viaggi,     accountId: bankId })
  fs.addTransaction({ date: dateAgo(198), description: 'Airbnb Londra',        amount: 280,  type: 'expense', category: CAT.viaggi,     accountId: bankId })
  fs.addTransaction({ date: dateAgo(320), description: 'Bonus fine anno',      amount: 2000, type: 'income',  category: CAT.stipendio,  accountId: bankId })
  fs.addTransaction({ date: dateAgo(310), description: 'iPhone 15 Pro',        amount: 1229, type: 'expense', category: CAT.shopping,   accountId: bankId })
  fs.addTransaction({ date: dateAgo(350), description: 'Vacanza Sicilia',      amount: 680,  type: 'expense', category: CAT.viaggi,     accountId: bankId })
}
