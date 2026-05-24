// ============================================================
// LEDGERNEST — Core TypeScript Types
// ============================================================

// ---- Finance -----------------------------------------------

export type Currency = 'EUR' | 'USD'
export type Theme = 'dark' | 'light' | 'system'
export type Locale = 'it' | 'en'

export interface Account {
  id: string
  name: string
  type: 'bank' | 'broker' | 'crypto' | 'other'
  icon: string
  balance: number
  currency: Currency
  broker?: string
  iban?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  date: string
  description: string
  merchant?: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  category: string
  accountId: string
  note?: string
  createdAt: string
}

export interface BudgetGroup {
  id: string
  label: string
  emoji: string
  color: string
  desc?: string
  order: number
}

export interface BudgetCategory {
  id: string
  name: string
  emoji: string
  color: string
  monthlyBudget: number
  group: string
  parentId?: string
  type?: 'income' | 'expense' | 'transfer'
  iconName?: string
  variable?: boolean
}

export interface RecurringItem {
  id: string
  name: string
  emoji: string
  amount: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDate: string
  category: string
  accountId: string
  type: 'income' | 'expense'
  active: boolean
  createdAt?: string
}

export interface Goal {
  id: string
  name: string
  icon: string
  color: string
  targetAmount: number
  currentAmount: number
  monthlyContribution: number
  deadline?: string
  accountId?: string
  createdAt: string
}

export interface Liability {
  id: string
  name: string
  note?: string
  type: 'mutuo' | 'prestito' | 'altro'
  residuo: number
  monthlyPayment: number
  interestRate: number
  endYear: number
  createdAt: string
}

export interface NetWorthSnapshot {
  id: string
  date: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  portfolioValue: number
  cashValue: number
}

// ---- Portfolio ----------------------------------------------

export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity'

export interface PortfolioPosition {
  id: string
  ticker: string
  name: string
  type: AssetType
  quantity: number
  avgPrice: number
  currency: Currency
  broker: string
  sector?: string
  region?: string
  ter?: number         // ETF total expense ratio
  createdAt: string
  updatedAt: string
}

export interface Trade {
  id: string
  positionId: string
  ticker: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  commission: number
  date: string
  currency: Currency
  note?: string
}

export interface Dividend {
  id: string
  ticker: string
  positionId: string
  amount: number
  payDate: string
  exDate: string
  currency: Currency
}

export interface PortfolioSnapshot {
  id: string
  date: string
  totalValue: number
  totalCost: number
  unrealizedPnl: number
  pnlPct: number
  byType: Record<AssetType, number>
}

// ---- Prices -------------------------------------------------

export interface Quote {
  ticker: string
  price: number
  priceEur?: number
  change: number
  changePct: number
  high: number
  low: number
  open: number
  prevClose: number
  volume: number
  marketCap?: number
  currency: string
  name?: string
  exchange?: string
  preMarket?: number
  preMarketEur?: number
  postMarket?: number
  postMarketEur?: number
  preMarketChange?: number
  preMarketChangePct?: number
  postMarketChange?: number
  postMarketChangePct?: number
  sparkline?: number[]   // 7-day hourly price history (from CoinGecko)
  timestamp: number
}

export interface OHLCCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PriceHistory {
  ticker: string
  interval: '1d' | '1wk' | '1mo'
  candles: OHLCCandle[]
}

// ---- Settings -----------------------------------------------

export interface AppSettings {
  theme: Theme
  locale: Locale
  currency: Currency
  refreshInterval: number
  showPrePostMarket: boolean
  accentColor: string
  density: 'compact' | 'normal' | 'comfortable'
  showPortfolioValue: boolean
  snapshotFrequency: 'daily' | 'weekly' | 'manual'
  font?: 'inter' | 'monospace' | 'system'
  animations?: boolean
  showLargeNumbers?: boolean
  hideSensitiveAmounts?: boolean
  sidebarColor?: string
  selfName?: string
  ignoreTransfers?: boolean
}

// ---- UI Store -----------------------------------------------

export type ModalType = 'movement' | 'buy' | 'goal' | 'account' | 'recurring' | 'editPosition' | 'quickAdd' | 'categoryManager' | null

export interface UIState {
  sidebarOpen: boolean
  searchOpen: boolean
  activeModal: ModalType
  modalProps?: Record<string, unknown>
}

// ---- API responses ------------------------------------------

export interface ApiResponse<T> {
  data: T
  error?: string
  cached?: boolean
  timestamp?: number
}

export interface PricesResponse {
  quotes: Quote[]
  eurUsd: number
  updatedAt: string
}

export interface ExportData {
  version: string
  exportedAt: string
  accounts: Account[]
  transactions: Transaction[]
  budgetCategories: BudgetCategory[]
  recurringItems: RecurringItem[]
  goals: Goal[]
  positions: PortfolioPosition[]
  trades: Trade[]
  dividends: Dividend[]
}
