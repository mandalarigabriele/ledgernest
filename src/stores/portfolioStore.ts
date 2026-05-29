import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PortfolioPosition, Trade, Dividend, AssetType } from '@/types'
import { nanoid } from './utils'
import { useFinanceStore } from './financeStore'
import { useSettingsStore } from './settingsStore'
import { usePortfolioSnapshotStore } from './portfolioSnapshotStore'

function findAccount(broker: string | undefined) {
  const { accounts } = useFinanceStore.getState()
  if (!accounts.length) return undefined
  if (broker) {
    const b = broker.toLowerCase()
    // 1. exact match on account.broker or account.name
    const exact = accounts.find((a) =>
      a.broker?.toLowerCase() === b || a.name.toLowerCase() === b
    )
    if (exact) return exact
    // 2. partial match (account name contains broker string or vice versa)
    const partial = accounts.find((a) =>
      a.broker?.toLowerCase().includes(b) || a.name.toLowerCase().includes(b) ||
      b.includes(a.broker?.toLowerCase() ?? '') || b.includes(a.name.toLowerCase())
    )
    if (partial) return partial
  }
  // 3. fallback: first broker-type account, then any account
  return accounts.find((a) => a.type === 'broker') ?? accounts[0]
}

const TYPE_TO_CATEGORY: Record<string, string> = {
  stock: 'Azioni', etf: 'ETF', crypto: 'Crypto', bond: 'Obbligazioni', commodity: 'Materie prime',
}

const INVESTMENT_CATEGORIES = new Set(['Investimenti', 'Azioni', 'ETF', 'Crypto', 'Obbligazioni', 'Materie prime'])

function createTradeMovement(trade: Trade, positions: PortfolioPosition[]) {
  const pos = positions.find((p) => p.id === trade.positionId)
  if (!pos) return
  const { addTransaction, transactions } = useFinanceStore.getState()
  const account = findAccount(pos.broker)
  if (!account) return
  // Skip if movement already exists (dedup by description + date)
  const desc = trade.type === 'buy'
    ? `Acquisto ${trade.ticker} ×${trade.quantity} @ ${trade.price}`
    : `Vendita ${trade.ticker} ×${trade.quantity} @ ${trade.price}`
  if (transactions.some((t) => t.description === desc && t.date === trade.date)) return
  const gross = trade.price * trade.quantity
  const net = trade.type === 'buy' ? gross + (trade.commission ?? 0) : gross - (trade.commission ?? 0)
  addTransaction({
    date: trade.date,
    description: desc,
    amount: net,
    type: trade.type === 'buy' ? 'expense' : 'income',
    category: TYPE_TO_CATEGORY[pos.type] ?? 'Investimenti',
    accountId: account.id,
    note: trade.note,
  })
}

function createDividendMovement(div: Dividend, positions: PortfolioPosition[]) {
  const pos = positions.find((p) => p.id === div.positionId)
  if (!pos) return
  const { addTransaction, transactions } = useFinanceStore.getState()
  const account = findAccount(pos.broker)
  if (!account) return
  const desc = `Dividendo ${div.ticker}`
  if (transactions.some((t) => t.description === desc && t.date === div.payDate)) return
  addTransaction({
    date: div.payDate,
    description: desc,
    amount: div.amount,
    type: 'income',
    category: 'Investimenti',
    accountId: account.id,
  })
}

interface PortfolioStore {
  positions: PortfolioPosition[]
  trades: Trade[]
  dividends: Dividend[]
  dividendsLastSyncedAt: number

  addPosition: (pos: Omit<PortfolioPosition, 'id' | 'createdAt' | 'updatedAt'>) => void
  updatePosition: (id: string, patch: Partial<PortfolioPosition>) => void
  deletePosition: (id: string) => void
  resetPortfolio: () => void

  addTrade: (trade: Omit<Trade, 'id'>) => void
  updateTrade: (id: string, patch: Partial<Pick<Trade, 'price' | 'quantity' | 'commission' | 'date' | 'note'>>) => void
  deleteTrade: (id: string) => void
  backfillTradesFromTransactions: (positionId: string) => void

  addDividend: (div: Omit<Dividend, 'id'>) => void
  importDividend: (div: Omit<Dividend, 'id'>) => void
  deleteDividend: (id: string) => void
  setDividendsLastSyncedAt: (ts: number) => void

  totalValue: (prices: Record<string, number>) => number
  totalCost: () => number
  byType: () => Record<AssetType, PortfolioPosition[]>
  backfillMovements: () => void

  hydrate: (data: Partial<Pick<PortfolioStore, 'positions' | 'trades' | 'dividends' | 'dividendsLastSyncedAt'>>) => void
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      positions: [],
      trades: [],
      dividends: [],
      dividendsLastSyncedAt: 0,

      addPosition: (pos) => {
        const now = new Date().toISOString()
        set((s) => ({
          positions: [...s.positions, { ...pos, id: nanoid(), createdAt: now, updatedAt: now }],
        }))
      },

      updatePosition: (id, patch) => {
        set((s) => ({
          positions: s.positions.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
          ),
        }))
      },

      deletePosition: (id) => {
        const pos = get().positions.find((p) => p.id === id)
        set((s) => ({
          positions: s.positions.filter((p) => p.id !== id),
          trades: s.trades.filter((t) => t.positionId !== id),
        }))
        if (pos) {
          const { transactions, deleteTransaction } = useFinanceStore.getState()
          const ticker = pos.ticker
          transactions
            .filter((t) => INVESTMENT_CATEGORIES.has(t.category) && (
              t.description.startsWith(`Acquisto ${ticker} `) ||
              t.description.startsWith(`Vendita ${ticker} `) ||
              t.description.startsWith(`Dividendo ${ticker}`)
            ))
            .forEach((t) => deleteTransaction(t.id))
        }
      },

      resetPortfolio: () => {
        set({ positions: [], trades: [], dividends: [] })
        // Remove auto-generated investment transactions
        const { transactions, deleteTransaction } = useFinanceStore.getState()
        const autoDesc = /^(Acquisto |Vendita |Dividendo )/
        transactions
          .filter((t) => INVESTMENT_CATEGORIES.has(t.category) && autoDesc.test(t.description))
          .forEach((t) => deleteTransaction(t.id))
        // Clear remembered ignored IDs so next import starts fresh
        useSettingsStore.getState().clearIgnoredImportIds()
        // Clear chart snapshots so history starts fresh after reset
        usePortfolioSnapshotStore.getState().clearSnapshots()
      },

      addTrade: (trade) => {
        const newTrade = { ...trade, id: nanoid() }
        set((s) => ({ trades: [...s.trades, newTrade] }))
        // Update position avg price
        const { positions } = get()
        const pos = positions.find((p) => p.id === trade.positionId)
        if (pos && trade.type === 'buy') {
          const totalCost = pos.avgPrice * pos.quantity + trade.price * trade.quantity + (trade.commission ?? 0)
          const newQty = pos.quantity + trade.quantity
          set((s) => ({
            positions: s.positions.map((p) =>
              p.id === trade.positionId
                ? { ...p, quantity: newQty, avgPrice: totalCost / newQty, updatedAt: new Date().toISOString() }
                : p
            ),
          }))
        }
        // Create corresponding finance movement
        createTradeMovement(newTrade, get().positions)
      },

      updateTrade: (id, patch) => {
        const oldTrade = get().trades.find((t) => t.id === id)
        if (!oldTrade) return
        const updatedTrade = { ...oldTrade, ...patch }
        set((s) => ({ trades: s.trades.map((t) => t.id === id ? updatedTrade : t) }))
        // Recalculate position qty and avgPrice from all buy trades from scratch
        const buyTrades = get().trades.filter((t) => t.positionId === oldTrade.positionId && t.type === 'buy')
        if (buyTrades.length > 0) {
          const totalCost = buyTrades.reduce((s, t) => s + t.price * t.quantity + (t.commission ?? 0), 0)
          const totalQty  = buyTrades.reduce((s, t) => s + t.quantity, 0)
          set((s) => ({
            positions: s.positions.map((p) =>
              p.id === oldTrade.positionId
                ? { ...p, quantity: totalQty, avgPrice: totalCost / totalQty, updatedAt: new Date().toISOString() }
                : p
            ),
          }))
        }
        // Sync finance transaction: delete the old one and recreate with new data
        const oldDesc = oldTrade.type === 'buy'
          ? `Acquisto ${oldTrade.ticker} ×${oldTrade.quantity} @ ${oldTrade.price}`
          : `Vendita ${oldTrade.ticker} ×${oldTrade.quantity} @ ${oldTrade.price}`
        const { transactions, deleteTransaction } = useFinanceStore.getState()
        const oldTx = transactions.find((t) => t.description === oldDesc && t.date === oldTrade.date)
        if (oldTx) deleteTransaction(oldTx.id)
        createTradeMovement(updatedTrade, get().positions)
      },

      deleteTrade: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),

      backfillTradesFromTransactions: (positionId) => {
        const pos = get().positions.find((p) => p.id === positionId)
        if (!pos) return

        const { transactions } = useFinanceStore.getState()
        const existingTrades = get().trades.filter((t) => t.positionId === positionId)

        // Match both "Acquisto X ×qty @ price" (from addTrade) and "Acquisto X ×qty" (old CSV import)
        const esc = pos.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const REfull   = new RegExp(`^(Acquisto|Vendita) ${esc} ×([\\d.]+) @ ([\\d.]+)$`)
        const REsimple = new RegExp(`^(Acquisto|Vendita) ${esc} ×([\\d.]+)$`)

        const investTxs = transactions.filter(
          (tx) => INVESTMENT_CATEGORIES.has(tx.category) && (REfull.test(tx.description) || REsimple.test(tx.description))
        )

        let created = 0
        for (const tx of investTxs) {
          const mFull   = tx.description.match(REfull)
          const mSimple = tx.description.match(REsimple)
          const m = mFull ?? mSimple
          if (!m) continue

          const type     = m[1] === 'Acquisto' ? 'buy' : 'sell' as 'buy' | 'sell'
          const quantity = parseFloat(m[2])
          const price    = mFull ? parseFloat(m[3]) : (quantity > 0 ? tx.amount / quantity : 0)
          if (!quantity || !price) continue

          const alreadyExists = existingTrades.some(
            (t) => t.date === tx.date && Math.abs(t.quantity - quantity) < 0.0001 && Math.abs(t.price - price) < 0.01
          )
          if (alreadyExists) continue

          // Create trade WITHOUT regenerating the finance movement (it already exists)
          set((s) => ({
            trades: [...s.trades, {
              id: nanoid(), positionId, ticker: pos.ticker, type,
              quantity, price, commission: 0, date: tx.date, currency: pos.currency,
            }],
          }))
          created++
        }

        if (created === 0) return

        // Recalculate position qty and avgPrice from all buy trades
        const buyTrades = get().trades.filter((t) => t.positionId === positionId && t.type === 'buy')
        if (buyTrades.length > 0) {
          const totalCost = buyTrades.reduce((s, t) => s + t.price * t.quantity + (t.commission ?? 0), 0)
          const totalQty  = buyTrades.reduce((s, t) => s + t.quantity, 0)
          set((s) => ({
            positions: s.positions.map((p) =>
              p.id === positionId
                ? { ...p, quantity: totalQty, avgPrice: totalCost / totalQty, updatedAt: new Date().toISOString() }
                : p
            ),
          }))
        }
      },

      addDividend: (div) => {
        const newDiv = { ...div, id: nanoid() }
        set((s) => ({ dividends: [...s.dividends, newDiv] }))
        createDividendMovement(newDiv, get().positions)
      },

      // Import historical dividend without creating a finance movement
      importDividend: (div) => {
        const key = `${div.ticker}-${div.exDate}`
        const already = get().dividends.some((d) => `${d.ticker}-${d.exDate}` === key)
        if (!already) set((s) => ({ dividends: [...s.dividends, { ...div, id: nanoid() }] }))
      },

      deleteDividend: (id) => set((s) => ({ dividends: s.dividends.filter((d) => d.id !== id) })),
      setDividendsLastSyncedAt: (ts) => set({ dividendsLastSyncedAt: ts }),

      totalValue: (prices) => {
        const { positions } = get()
        return positions.reduce((sum, p) => {
          const price = prices[p.ticker] ?? p.avgPrice
          return sum + price * p.quantity
        }, 0)
      },

      totalCost: () => {
        const { positions } = get()
        return positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0)
      },

      byType: () => {
        const { positions } = get()
        const result: Record<AssetType, PortfolioPosition[]> = {
          stock: [], etf: [], crypto: [], bond: [], commodity: [],
        }
        for (const p of positions) result[p.type].push(p)
        return result
      },

      backfillMovements: () => {
        const { positions, trades, dividends } = get()
        for (const trade of trades) createTradeMovement(trade, positions)
        for (const div of dividends) createDividendMovement(div, positions)
      },

      hydrate: (data) => set(data),
    }),
    { name: 'ledgernest-portfolio', skipHydration: true }
  )
)
