import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, Transaction, BudgetCategory, BudgetGroup, RecurringItem, Goal, Liability, Property, NetWorthSnapshot } from '@/types'
import { nanoid } from './utils'

interface BudgetMonthPlan {
  income: number
  incomeSources?: Record<string, number>   // categoryId → planned income amount
  categories: Record<string, number>       // categoryId → monthly budget amount
  groupBudgets?: Record<string, number>    // groupKey → total group budget (envelope)
  assetAllocation: Record<string, number>  // assetType key → target %
  investPct?: number                       // % of income to allocate to investments
  investCatAlloc?: Record<string, number>  // catId → % share of invest quota (should sum to 100)
  categoryNotes?: Record<string, string>   // catId → free text note for this month
}

interface FinanceStore {
  accounts: Account[]
  transactions: Transaction[]
  budgetCategories: BudgetCategory[]
  budgetGroups: BudgetGroup[]
  recurringItems: RecurringItem[]
  goals: Goal[]
  liabilities: Liability[]
  netWorthSnapshots: NetWorthSnapshot[]
  budgetPlans: Record<string, BudgetMonthPlan> // key: 'YYYY-MM'

  // Budget groups
  addBudgetGroup: (g: Omit<BudgetGroup, 'id' | 'order'>) => void
  updateBudgetGroup: (id: string, patch: Partial<Omit<BudgetGroup, 'id'>>) => void
  deleteBudgetGroup: (id: string) => void

  // Accounts
  addAccount: (acct: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  deleteAccount: (id: string) => void
  clearAccountTransactions: (id: string) => void

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => string
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  clearAccountOBTransactions: (accountId: string) => void

  // Budget
  addBudgetCategory: (cat: Omit<BudgetCategory, 'id'>) => void
  updateBudgetCategory: (id: string, patch: Partial<BudgetCategory>) => void
  deleteBudgetCategory: (id: string) => void
  reorderBudgetCategories: (ids: string[]) => void

  // Budget plans (per month)
  setMonthPlanIncome: (month: string, income: number) => void
  setMonthPlanCategory: (month: string, catId: string, amount: number) => void
  setMonthPlanAssetAllocation: (month: string, allocation: Record<string, number>) => void
  setMonthPlanInvestConfig: (month: string, investPct: number, investCatAlloc: Record<string, number>) => void
  setMonthPlanIncomeSources: (month: string, sources: Record<string, number>) => void
  setGroupBudget: (month: string, groupKey: string, amount: number) => void
  setMonthPlanCategoryNote: (month: string, catId: string, note: string) => void
  resetMonthPlan: (month: string) => void

  // Recurring
  addRecurring: (item: Omit<RecurringItem, 'id'>) => void
  updateRecurring: (id: string, patch: Partial<RecurringItem>) => void
  deleteRecurring: (id: string) => void

  // Goals
  featuredGoalId: string | null
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  setFeaturedGoal: (id: string | null) => void

  // Liabilities
  addLiability: (l: Omit<Liability, 'id' | 'createdAt'>) => void
  updateLiability: (id: string, patch: Partial<Liability>) => void
  deleteLiability: (id: string) => void

  // Properties (real estate)
  properties: Property[]
  addProperty: (p: Omit<Property, 'id' | 'createdAt'>) => void
  updateProperty: (id: string, patch: Partial<Property>) => void
  deleteProperty: (id: string) => void

  // Net worth history
  takeNetWorthSnapshot: (portfolioValue: number) => void

  // Computed
  totalCash: () => number
  monthlyIncome: (month: string) => number
  monthlyExpenses: (month: string) => number
  netWorth: () => number

  // Merchant aliases (merge rules) + logos
  merchantAliases: Record<string, string>   // alias.toLowerCase() → canonical name
  merchantLogos:   Record<string, string>   // merchant name → emoji or URL
  mergeMerchants: (aliases: string[], canonical: string) => void
  deleteMerchantAlias: (alias: string) => void
  setMerchantLogo: (merchant: string, logo: string) => void
  normalizeMerchants: (normalizer: (m: string) => string) => void

  resetAll: () => void
  hydrate: (data: Partial<Pick<FinanceStore, 'accounts' | 'transactions' | 'budgetCategories' | 'budgetGroups' | 'recurringItems' | 'goals' | 'liabilities' | 'netWorthSnapshots' | 'budgetPlans' | 'merchantAliases' | 'merchantLogos' | 'featuredGoalId' | 'properties'>>) => void
}

const defaultBudgetGroups: BudgetGroup[] = [
  { id: 'income',      label: 'Entrate',       emoji: '🟢', color: '#4ade80', order: 0 },
  { id: 'needs',       label: 'Necessità',     emoji: '🔴', color: '#f85149', order: 1, desc: 'Mutuo, spesa, trasporti' },
  { id: 'lifestyle',   label: 'Stile di vita', emoji: '🟡', color: '#d29922', order: 2, desc: 'Ristoranti, shopping' },
  { id: 'finance',     label: 'Finanze',       emoji: '🟣', color: '#7c6df7', order: 3, desc: 'Prestiti, assicurazioni' },
  { id: 'investments', label: 'Investimenti',  emoji: '🔵', color: '#5bc8d0', order: 4, desc: 'PAC mensile, crypto' },
  { id: 'transfers',   label: 'Trasferimenti', emoji: '⚪', color: '#94a3b8', order: 5 },
]

const defaultCategories: BudgetCategory[] = [
  // ── ENTRATE — categorie ──────────────────────────────────────
  { id: 'sub-lavoro',  name: 'Lavoro',   emoji: '💼', color: '#4ade80', monthlyBudget: 0, group: 'income', type: 'income' },
  { id: 'sub-rendite', name: 'Rendite',  emoji: '📈', color: '#5bc8d0', monthlyBudget: 0, group: 'income', type: 'income' },
  // ── ENTRATE — Lavoro ─────────────────────────────────────────
  { id: 'inc-1', name: 'Stipendio',     emoji: '💼', color: '#4ade80', monthlyBudget: 0, group: 'income', type: 'income', parentId: 'sub-lavoro' },
  { id: 'inc-4', name: 'Bonus / Extra', emoji: '🎁', color: '#f77c3a', monthlyBudget: 0, group: 'income', type: 'income', parentId: 'sub-lavoro' },
  // ── ENTRATE — Rendite ────────────────────────────────────────
  { id: 'inc-3', name: 'Dividendi',     emoji: '📈', color: '#5bc8d0', monthlyBudget: 0, group: 'income', type: 'income', parentId: 'sub-rendite' },
  { id: 'inc-2', name: 'Rimborsi',      emoji: '🔄', color: '#86efac', monthlyBudget: 0, group: 'income', type: 'income', parentId: 'sub-rendite' },
  { id: 'inc-5', name: 'Altro',         emoji: '💰', color: '#a78bfa', monthlyBudget: 0, group: 'income', type: 'income', parentId: 'sub-rendite' },
  // ── NECESSITÀ — subcategorie ────────────────────────────────
  { id: 'sub-casa',  name: 'Casa',            emoji: '🏠', color: '#7c6df7', monthlyBudget: 0, group: 'needs', type: 'expense' },
  { id: 'sub-trasp', name: 'Trasporti',       emoji: '🚗', color: '#58a6ff', monthlyBudget: 0, group: 'needs', type: 'expense' },
  { id: 'sub-vitaq', name: 'Vita quotidiana', emoji: '🍏', color: '#4ade80', monthlyBudget: 0, group: 'needs', type: 'expense' },
  // ── NECESSITÀ — Casa ────────────────────────────────────────
  { id: 'cat-mutuo',   name: 'Mutuo',            emoji: '🏠', color: '#7c6df7', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-casa' },
  { id: 'cat-affitto', name: 'Affitto',           emoji: '🏡', color: '#8b5cf6', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-casa' },
  { id: 'cat-utenze',  name: 'Utenze',            emoji: '💡', color: '#d29922', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-casa' },
  { id: 'cat-mancasa', name: 'Manutenzione casa', emoji: '🔧', color: '#78716c', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-casa' },
  // ── NECESSITÀ — Trasporti ───────────────────────────────────
  { id: 'cat-ratauto', name: 'Rata auto',          emoji: '🚗', color: '#58a6ff', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  { id: 'cat-carb',    name: 'Carburante',          emoji: '⛽', color: '#d29922', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  { id: 'cat-manauto', name: 'Manutenzione auto',   emoji: '🔧', color: '#94a3b8', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  { id: 'cat-tpub',    name: 'Trasporto pubblico',  emoji: '🚇', color: '#38bdf8', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  { id: 'cat-parch',   name: 'Parcheggi e pedaggi', emoji: '🅿️', color: '#64748b', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  { id: 'cat-taxi',    name: 'Taxi e ride sharing', emoji: '🚕', color: '#fbbf24', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-trasp' },
  // ── NECESSITÀ — Vita quotidiana ─────────────────────────────
  { id: 'cat-spesa',  name: 'Spesa',  emoji: '🛒', color: '#4ade80', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-vitaq' },
  { id: 'cat-sanita', name: 'Sanità', emoji: '🏥', color: '#f85149', monthlyBudget: 0, group: 'needs', type: 'expense', parentId: 'sub-vitaq' },
  // ── STILE DI VITA — subcategorie ────────────────────────────
  { id: 'sub-food',    name: 'Food & Dining', emoji: '🍕', color: '#f77c3a', monthlyBudget: 0, group: 'lifestyle', type: 'expense' },
  { id: 'sub-leisure', name: 'Tempo libero',  emoji: '🎮', color: '#06b6d4', monthlyBudget: 0, group: 'lifestyle', type: 'expense' },
  { id: 'sub-shop',    name: 'Shopping',      emoji: '🛒', color: '#e879a8', monthlyBudget: 0, group: 'lifestyle', type: 'expense' },
  { id: 'sub-pers',    name: 'Personale',     emoji: '💆', color: '#a78bfa', monthlyBudget: 0, group: 'lifestyle', type: 'expense' },
  // ── STILE DI VITA — Food & Dining ───────────────────────────
  { id: 'cat-rist',  name: 'Ristoranti', emoji: '🍝', color: '#f77c3a', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-food' },
  { id: 'cat-caffe', name: 'Caffè',      emoji: '☕', color: '#d97706', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-food' },
  // ── STILE DI VITA — Tempo libero ────────────────────────────
  { id: 'cat-viaggi', name: 'Viaggi',           emoji: '✈️', color: '#06b6d4', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-leisure' },
  { id: 'cat-intrat', name: 'Intrattenimento',  emoji: '🎬', color: '#7c6df7', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-leisure' },
  { id: 'cat-hobby',  name: 'Hobby',            emoji: '🎯', color: '#84cc16', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-leisure' },
  // ── STILE DI VITA — Shopping ────────────────────────────────
  { id: 'cat-abbig',   name: 'Abbigliamento', emoji: '👗', color: '#e879a8', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-shop' },
  { id: 'cat-elec',    name: 'Elettronica',   emoji: '💻', color: '#38bdf8', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-shop' },
  { id: 'cat-casaarr', name: 'Casa e arredo', emoji: '🛋️', color: '#a16207', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-shop' },
  // ── STILE DI VITA — Personale ───────────────────────────────
  { id: 'cat-curap',  name: 'Cura personale',    emoji: '💆', color: '#fb7185', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-pers' },
  { id: 'cat-anim',   name: 'Animali domestici', emoji: '🐾', color: '#78716c', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-pers' },
  { id: 'cat-spesep', name: 'Spese personali',   emoji: '💸', color: '#a78bfa', monthlyBudget: 0, group: 'lifestyle', type: 'expense', parentId: 'sub-pers' },
  // ── FINANZE — categoria ──────────────────────────────────────
  { id: 'sub-finanza',  name: 'Spese finanziarie', emoji: '💳', color: '#7c6df7', monthlyBudget: 0, group: 'finance', type: 'expense' },
  // ── FINANZE — Spese finanziarie ──────────────────────────────
  { id: 'cat-prest',  name: 'Prestiti',      emoji: '💳', color: '#f85149', monthlyBudget: 0, group: 'finance', type: 'expense', parentId: 'sub-finanza' },
  { id: 'cat-comm',   name: 'Commissioni',   emoji: '💸', color: '#94a3b8', monthlyBudget: 0, group: 'finance', type: 'expense', parentId: 'sub-finanza' },
  { id: 'cat-assic',  name: 'Assicurazioni', emoji: '🛡️', color: '#64748b', monthlyBudget: 0, group: 'finance', type: 'expense', parentId: 'sub-finanza' },
  { id: 'cat-tasse',  name: 'Tasse',         emoji: '📋', color: '#d29922', monthlyBudget: 0, group: 'finance', type: 'expense', parentId: 'sub-finanza' },
  // ── INVESTIMENTI — categorie ─────────────────────────────────
  { id: 'sub-merc',  name: 'Mercati',      emoji: '📊', color: '#5bc8d0', monthlyBudget: 0, group: 'investments', type: 'expense' },
  { id: 'sub-alt',   name: 'Alternativi',  emoji: '₿',  color: '#f77c3a', monthlyBudget: 0, group: 'investments', type: 'expense' },
  // ── INVESTIMENTI — Mercati ───────────────────────────────────
  { id: 'cat-azioni',   name: 'Azioni',       emoji: '📊', color: '#5bc8d0', monthlyBudget: 0, group: 'investments', type: 'expense', parentId: 'sub-merc' },
  { id: 'cat-etf',      name: 'ETF',          emoji: '📈', color: '#3fb950', monthlyBudget: 0, group: 'investments', type: 'expense', parentId: 'sub-merc' },
  { id: 'cat-obblig',   name: 'Obbligazioni', emoji: '📜', color: '#7c6df7', monthlyBudget: 0, group: 'investments', type: 'expense', parentId: 'sub-merc' },
  // ── INVESTIMENTI — Alternativi ───────────────────────────────
  { id: 'cat-crypto',   name: 'Crypto',        emoji: '₿',  color: '#f77c3a', monthlyBudget: 0, group: 'investments', type: 'expense', parentId: 'sub-alt' },
  { id: 'cat-matprime', name: 'Materie prime', emoji: '🥇', color: '#d29922', monthlyBudget: 0, group: 'investments', type: 'expense', parentId: 'sub-alt' },
  // ── TRASFERIMENTI — categoria ─────────────────────────────────
  { id: 'sub-giri', name: 'Giri conto', emoji: '🔄', color: '#94a3b8', monthlyBudget: 0, group: 'transfers', type: 'transfer' },
  // ── TRASFERIMENTI — Giri conto ───────────────────────────────
  { id: 'cat-trasf', name: 'Trasferimenti',    emoji: '🔄', color: '#94a3b8', monthlyBudget: 0, group: 'transfers', type: 'transfer', parentId: 'sub-giri' },
  { id: 'cat-cc',    name: 'Carta di credito', emoji: '💳', color: '#64748b', monthlyBudget: 0, group: 'transfers', type: 'transfer', parentId: 'sub-giri' },
  { id: 'cat-rett',  name: 'Rettifiche saldo', emoji: '⚖️', color: '#78716c', monthlyBudget: 0, group: 'transfers', type: 'transfer', parentId: 'sub-giri' },
]

const initialFinanceState = {
  accounts: [] as Account[],
  transactions: [] as Transaction[],
  budgetCategories: defaultCategories,
  budgetGroups: defaultBudgetGroups,
  recurringItems: [] as RecurringItem[],
  goals: [] as Goal[],
  featuredGoalId: null as string | null,
  liabilities: [] as Liability[],
  properties: [] as Property[],
  netWorthSnapshots: [] as NetWorthSnapshot[],
  budgetPlans: {} as Record<string, BudgetMonthPlan>,
  merchantAliases: {} as Record<string, string>,
  merchantLogos:   {} as Record<string, string>,
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      ...initialFinanceState,

      addAccount: (acct) => {
        const now = new Date().toISOString()
        set((s) => ({ accounts: [...s.accounts, { ...acct, id: nanoid(), createdAt: now, updatedAt: now }] }))
      },
      updateAccount: (id, patch) => {
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
          ),
        }))
      },
      deleteAccount: (id) => set((s) => ({
        accounts: s.accounts.filter((a) => a.id !== id),
        transactions: s.transactions.filter((t) => t.accountId !== id),
      })),
      clearAccountTransactions: (id) => set((s) => ({
        transactions: s.transactions.filter((t) => t.accountId !== id),
      })),
      // Silently removes OB-synced transactions (ebId set) for an account — used by hard-reset
      // Does NOT call the PATCH endpoint; server dedup is already cleared by the API
      clearAccountOBTransactions: (accountId) => set((s) => ({
        transactions: s.transactions.filter((t) => !(t.accountId === accountId && !!t.ebId)),
      })),

      addTransaction: (tx) => {
        const id = nanoid()
        const now = new Date().toISOString()
        set((s) => ({ transactions: [{ ...tx, id, createdAt: now }, ...s.transactions] }))
        // OB-synced accounts: balance is managed by the banking API — never modify locally
        const { accounts } = get()
        const acct = accounts.find((a) => a.id === tx.accountId)
        if (acct && !acct.bankingUid) {
          const delta = tx.type === 'income' ? tx.amount : -tx.amount
          set((s) => ({
            accounts: s.accounts.map((a) =>
              a.id === tx.accountId ? { ...a, balance: a.balance + delta } : a
            ),
          }))
        }
        return id
      },
      updateTransaction: (id, patch) => {
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
      },
      deleteTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id)
        // Mark as user-deleted in DB so force-sync won't reimport it
        if (tx?.ebId) {
          fetch('/api/banking/transactions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ebId: tx.ebId, userDeleted: true }),
          }).catch(() => {/* best-effort */})
        }
        // Remove linked shared expense if any (no-op server-side if none exists)
        fetch(`/api/shared-expenses?sourceTxId=${encodeURIComponent(id)}`, { method: 'DELETE' })
          .catch(() => {/* best-effort */})
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
      },

      mergeMerchants: (aliases, canonical) => set((s) => {
        const updated = s.transactions.map((t) =>
          t.merchant && aliases.includes(t.merchant) ? { ...t, merchant: canonical } : t
        )
        const newAliases = { ...s.merchantAliases }
        for (const alias of aliases) {
          if (alias !== canonical) newAliases[alias.toLowerCase()] = canonical
        }
        return { transactions: updated, merchantAliases: newAliases }
      }),
      deleteMerchantAlias: (alias) => set((s) => {
        const newAliases = { ...s.merchantAliases }
        delete newAliases[alias]
        return { merchantAliases: newAliases }
      }),
      setMerchantLogo: (merchant, logo) => set((s) => ({
        merchantLogos: logo
          ? { ...s.merchantLogos, [merchant]: logo }
          : Object.fromEntries(Object.entries(s.merchantLogos).filter(([k]) => k !== merchant)),
      })),

      normalizeMerchants: (normalizer) => set((s) => ({
        transactions: s.transactions.map((t) =>
          t.merchant ? { ...t, merchant: normalizer(t.merchant) } : t
        ),
      })),

      addBudgetGroup: (g) => set((s) => ({
        budgetGroups: [...s.budgetGroups, { ...g, id: nanoid(), order: s.budgetGroups.length }],
      })),
      updateBudgetGroup: (id, patch) => set((s) => ({
        budgetGroups: s.budgetGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      })),
      deleteBudgetGroup: (id) => set((s) => ({
        budgetGroups: s.budgetGroups.filter((g) => g.id !== id),
        budgetCategories: s.budgetCategories.filter((c) => c.group !== id),
      })),

      addBudgetCategory: (cat) => set((s) => ({ budgetCategories: [...s.budgetCategories, { ...cat, id: nanoid() }] })),
      updateBudgetCategory: (id, patch) => {
        set((s) => ({ budgetCategories: s.budgetCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
      },
      deleteBudgetCategory: (id) => set((s) => ({
        budgetCategories: s.budgetCategories.filter((c) => c.id !== id && c.parentId !== id),
      })),
      reorderBudgetCategories: (ids) => set((s) => {
        const map = new Map(s.budgetCategories.map((c) => [c.id, c]))
        const reordered = ids.map((id) => map.get(id)).filter(Boolean) as BudgetCategory[]
        const untouched = s.budgetCategories.filter((c) => !ids.includes(c.id))
        return { budgetCategories: [...reordered, ...untouched] }
      }),

      setMonthPlanIncome: (month, income) => set((s) => ({
        budgetPlans: {
          ...s.budgetPlans,
          [month]: { ...(s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }), income },
        },
      })),
      setMonthPlanCategory: (month, catId, amount) => set((s) => {
        const plan = s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }
        return {
          budgetPlans: {
            ...s.budgetPlans,
            [month]: { ...plan, categories: { ...plan.categories, [catId]: amount } },
          },
        }
      }),
      setMonthPlanAssetAllocation: (month, allocation) => set((s) => ({
        budgetPlans: {
          ...s.budgetPlans,
          [month]: { ...(s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }), assetAllocation: allocation },
        },
      })),
      setMonthPlanInvestConfig: (month, investPct, investCatAlloc) => set((s) => ({
        budgetPlans: {
          ...s.budgetPlans,
          [month]: { ...(s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }), investPct, investCatAlloc },
        },
      })),
      setMonthPlanIncomeSources: (month, sources) => set((s) => {
        const total = Object.values(sources).reduce((sum, v) => sum + v, 0)
        return {
          budgetPlans: {
            ...s.budgetPlans,
            [month]: {
              ...(s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }),
              incomeSources: sources,
              income: total,
            },
          },
        }
      }),
      setGroupBudget: (month, groupKey, amount) => set((s) => {
        const plan = s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }
        return {
          budgetPlans: {
            ...s.budgetPlans,
            [month]: { ...plan, groupBudgets: { ...(plan.groupBudgets ?? {}), [groupKey]: amount } },
          },
        }
      }),
      setMonthPlanCategoryNote: (month, catId, note) => set((s) => {
        const plan = s.budgetPlans[month] ?? { income: 0, categories: {}, assetAllocation: {} }
        const notes = { ...(plan.categoryNotes ?? {}), [catId]: note }
        if (!note) delete notes[catId]
        return {
          budgetPlans: {
            ...s.budgetPlans,
            [month]: { ...plan, categoryNotes: notes },
          },
        }
      }),
      resetMonthPlan: (month) => set((s) => {
        const plans = { ...s.budgetPlans }
        delete plans[month]
        return { budgetPlans: plans }
      }),

      addRecurring: (item) => set((s) => ({ recurringItems: [...s.recurringItems, { ...item, id: nanoid(), createdAt: new Date().toISOString() }] })),
      updateRecurring: (id, patch) => {
        set((s) => ({ recurringItems: s.recurringItems.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
      },
      deleteRecurring: (id) => set((s) => ({ recurringItems: s.recurringItems.filter((r) => r.id !== id) })),

      addGoal: (goal) => {
        const now = new Date().toISOString()
        set((s) => ({ goals: [...s.goals, { ...goal, id: nanoid(), createdAt: now }] }))
      },
      updateGoal: (id, patch) => {
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
      },
      deleteGoal: (id) => set((s) => ({
        goals: s.goals.filter((g) => g.id !== id),
        featuredGoalId: s.featuredGoalId === id ? null : s.featuredGoalId,
      })),
      setFeaturedGoal: (id) => set({ featuredGoalId: id }),

      addLiability: (l) => {
        const now = new Date().toISOString()
        set((s) => ({ liabilities: [...s.liabilities, { ...l, id: nanoid(), createdAt: now }] }))
      },
      updateLiability: (id, patch) => {
        set((s) => ({ liabilities: s.liabilities.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
      },
      deleteLiability: (id) => set((s) => ({ liabilities: s.liabilities.filter((l) => l.id !== id) })),

      addProperty: (p) => {
        const now = new Date().toISOString()
        set((s) => ({ properties: [...s.properties, { ...p, id: nanoid(), createdAt: now }] }))
      },
      updateProperty: (id, patch) => {
        set((s) => ({ properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      },
      deleteProperty: (id) => set((s) => ({ properties: s.properties.filter((p) => p.id !== id) })),

      takeNetWorthSnapshot: (portfolioValue) => {
        const { accounts, liabilities } = get()
        const cashValue = accounts.reduce((s, a) => s + a.balance, 0)
        const totalAssets = cashValue + portfolioValue
        const totalLiabilities = liabilities.reduce((s, l) => s + l.residuo, 0)
        const snap: NetWorthSnapshot = {
          id: nanoid(),
          date: new Date().toISOString().slice(0, 10),
          totalAssets,
          totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
          portfolioValue,
          cashValue,
        }
        set((s) => ({
          netWorthSnapshots: [
            ...s.netWorthSnapshots.filter((n) => n.date !== snap.date),
            snap,
          ].slice(-90),
        }))
      },

      totalCash: () => get().accounts.reduce((sum, a) => sum + a.balance, 0),

      monthlyIncome: (month) => {
        const txs = get().transactions.filter(
          (t) => t.type === 'income' && t.date.startsWith(month)
        )
        return txs.reduce((sum, t) => sum + t.amount, 0)
      },

      monthlyExpenses: (month) => {
        const txs = get().transactions.filter(
          (t) => t.type === 'expense' && t.date.startsWith(month)
        )
        return txs.reduce((sum, t) => sum + t.amount, 0)
      },

      netWorth: () => {
        const assets = get().accounts.reduce((sum, a) => sum + a.balance, 0)
        const liabTotal = get().liabilities.reduce((sum, l) => sum + l.residuo, 0)
        return assets - liabTotal
      },

      resetAll: () => set({ ...initialFinanceState }),

      hydrate: (data) => set(data),
    }),
    {
      name: 'ledgernest-finance',
      skipHydration: true,
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<typeof initialFinanceState>

        // v3 → v4: reset categories, wipe plans
        if (version < 4) {
          state.budgetCategories = defaultCategories
          state.budgetPlans = {}
        }
        if (!state.budgetGroups || state.budgetGroups.length === 0) {
          state.budgetGroups = defaultBudgetGroups
        }

        // v4 → v5: add mid-level Categorie for finance & investments
        if (version < 5) {
          const cats = [...(state.budgetCategories ?? [])]
          const catIds = new Set(cats.map((c) => c.id))

          if (!catIds.has('sub-finanza')) {
            cats.push({ id: 'sub-finanza', name: 'Spese finanziarie', emoji: '💳', color: '#7c6df7', monthlyBudget: 0, group: 'finance', type: 'expense' })
          }
          if (!catIds.has('sub-merc')) {
            cats.push({ id: 'sub-merc', name: 'Mercati', emoji: '📊', color: '#5bc8d0', monthlyBudget: 0, group: 'investments', type: 'expense' })
          }
          if (!catIds.has('sub-alt')) {
            cats.push({ id: 'sub-alt', name: 'Alternativi', emoji: '₿', color: '#f77c3a', monthlyBudget: 0, group: 'investments', type: 'expense' })
          }

          const finLeaves  = new Set(['cat-prest', 'cat-comm', 'cat-assic', 'cat-tasse'])
          const mercLeaves = new Set(['cat-azioni', 'cat-etf', 'cat-obblig'])
          const altLeaves  = new Set(['cat-crypto', 'cat-matprime'])

          state.budgetCategories = cats.map((c) => {
            if (finLeaves.has(c.id)  && !c.parentId) return { ...c, parentId: 'sub-finanza' }
            if (mercLeaves.has(c.id) && !c.parentId) return { ...c, parentId: 'sub-merc' }
            if (altLeaves.has(c.id)  && !c.parentId) return { ...c, parentId: 'sub-alt' }
            return c
          })
        }

        // v5 → v6: add mid-level Categorie for income (Lavoro, Rendite)
        if (version < 6) {
          const cats = [...(state.budgetCategories ?? [])]
          const catIds = new Set(cats.map((c) => c.id))

          if (!catIds.has('sub-lavoro')) {
            cats.push({ id: 'sub-lavoro', name: 'Lavoro', emoji: '💼', color: '#4ade80', monthlyBudget: 0, group: 'income', type: 'income' })
          }
          if (!catIds.has('sub-rendite')) {
            cats.push({ id: 'sub-rendite', name: 'Rendite', emoji: '📈', color: '#5bc8d0', monthlyBudget: 0, group: 'income', type: 'income' })
          }

          const lavoroLeaves  = new Set(['inc-1', 'inc-4'])
          const renditeLeaves = new Set(['inc-2', 'inc-3', 'inc-5'])

          state.budgetCategories = cats.map((c) => {
            if (lavoroLeaves.has(c.id)  && !c.parentId) return { ...c, parentId: 'sub-lavoro' }
            if (renditeLeaves.has(c.id) && !c.parentId) return { ...c, parentId: 'sub-rendite' }
            return c
          })
        }

        return state
      },
    }
  )
)
