import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { SEED_PRODUCTS } from '../data/seed'
import type {
  AppState,
  CartItem,
  PackType,
  Product,
  Sale,
  StockLog,
} from '../types'
import { normalizeProduct } from '../types'
import { normalizeScanCode } from '../utils/scanCode'

const STORAGE_KEY = 'xianlin-supermarket-v1'

declare global {
  interface Window {
    desktopLedger?: {
      isDesktop: true
      getPath: () => Promise<string>
      getInfo: () => Promise<{
        path: string
        defaultPath: string
        isCustom: boolean
      }>
      load: () => Promise<AppState>
      save: (state: AppState) => Promise<boolean>
      reveal: () => Promise<string>
      chooseSavePath: () => Promise<{
        info: { path: string; defaultPath: string; isCustom: boolean }
        state: AppState
      } | null>
      chooseOpenPath: () => Promise<{
        info: { path: string; defaultPath: string; isCustom: boolean }
        state: AppState
      } | null>
      resetPath: () => Promise<{
        info: { path: string; defaultPath: string; isCustom: boolean }
        state: AppState
      }>
    }
  }
}

function isDesktop() {
  return typeof window !== 'undefined' && !!window.desktopLedger
}

function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.products?.length) {
        return {
          ...parsed,
          products: parsed.products.map((p) => normalizeProduct(p)),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { products: SEED_PRODUCTS, sales: [], stockLogs: [] }
}

function normalizeState(appState: AppState): AppState {
  return {
    ...appState,
    products: (appState.products || []).map((p) => normalizeProduct(p)),
  }
}

let state: AppState = { products: [], sales: [], stockLogs: [] }
let ready = false
let dbPath = ''
let dbDefaultPath = ''
let dbIsCustom = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function persist(next: AppState) {
  if (isDesktop() && window.desktopLedger) {
    void window.desktopLedger.save(next).catch((err) => {
      console.error('保存 ledger.db 失败', err)
    })
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
}

function setState(next: AppState | ((prev: AppState) => AppState)) {
  state = typeof next === 'function' ? next(state) : next
  if (ready) persist(state)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

function uid() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

let bootPromise: Promise<void> | null = null

export function bootStore() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    if (isDesktop() && window.desktopLedger) {
      const info = await window.desktopLedger.getInfo()
      dbPath = info.path
      dbDefaultPath = info.defaultPath
      dbIsCustom = info.isCustom
      state = normalizeState(await window.desktopLedger.load())
    } else {
      state = loadLocalState()
      dbPath = ''
      dbDefaultPath = ''
      dbIsCustom = false
    }
    ready = true
    emit()
  })()
  return bootPromise
}

export function useAppStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [hydrated, setHydrated] = useState(ready)
  const [path, setPath] = useState(dbPath)
  const [defaultPath, setDefaultPath] = useState(dbDefaultPath)
  const [isCustom, setIsCustom] = useState(dbIsCustom)

  useEffect(() => {
    void bootStore().then(() => {
      setHydrated(true)
      setPath(dbPath)
      setDefaultPath(dbDefaultPath)
      setIsCustom(dbIsCustom)
    })
  }, [])

  const applyDbSwitch = useCallback(
    (result: {
      info: { path: string; defaultPath: string; isCustom: boolean }
      state: AppState
    }) => {
      dbPath = result.info.path
      dbDefaultPath = result.info.defaultPath
      dbIsCustom = result.info.isCustom
      state = normalizeState(result.state)
      setPath(dbPath)
      setDefaultPath(dbDefaultPath)
      setIsCustom(dbIsCustom)
      emit()
    },
    [],
  )
  const addProduct = useCallback(
    (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
      const product = normalizeProduct({
        ...data,
        id: uid(),
        createdAt: now(),
        updatedAt: now(),
      })
      setState((s) => ({ ...s, products: [...s.products, product] }))
      return product
    },
    [],
  )

  const updateProduct = useCallback(
    (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
      setState((s) => ({
        ...s,
        products: s.products.map((p) =>
          p.id === id
            ? normalizeProduct({ ...p, ...patch, updatedAt: now() })
            : p,
        ),
      }))
    },
    [],
  )

  const deleteProduct = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== id),
    }))
  }, [])

  const adjustStock = useCallback(
    (
      productId: string,
      delta: number,
      type: StockLog['type'],
      note: string,
    ) => {
      setState((s) => {
        const product = s.products.find((p) => p.id === productId)
        if (!product) return s
        const before = product.stock
        const after = Math.max(0, before + delta)
        const log: StockLog = {
          id: uid(),
          productId,
          productName: product.name,
          type,
          quantity: Math.abs(delta),
          before,
          after,
          note,
          createdAt: now(),
        }
        return {
          ...s,
          products: s.products.map((p) =>
            p.id === productId
              ? { ...p, stock: after, updatedAt: now() }
              : p,
          ),
          stockLogs: [log, ...s.stockLogs],
        }
      })
    },
    [],
  )

  const checkout = useCallback(
    (
      items: CartItem[],
      paymentMethod: Sale['paymentMethod'],
      paid: number,
    ): Sale | null => {
      if (!items.length) return null

      let sale: Sale | null = null

      setState((s) => {
        const products = [...s.products]
        const saleItems = items.map((item) => {
          const stockQty = item.stockQty ?? item.quantity
          const idx = products.findIndex((p) => p.id === item.productId)
          if (idx >= 0) {
            products[idx] = {
              ...products[idx],
              stock: Math.max(0, products[idx].stock - stockQty),
              updatedAt: now(),
            }
          }
          return {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: +(item.price * item.quantity).toFixed(2),
            stockQty,
            pack: item.pack,
          }
        })

        const total = +saleItems
          .reduce((sum, i) => sum + i.subtotal, 0)
          .toFixed(2)

        sale = {
          id: uid(),
          items: saleItems,
          total,
          paid,
          change: +(Math.max(0, paid - total)).toFixed(2),
          paymentMethod,
          createdAt: now(),
        }

        const logs: StockLog[] = items.map((item) => {
          const product = s.products.find((p) => p.id === item.productId)!
          const stockQty = item.stockQty ?? item.quantity
          const after = Math.max(0, product.stock - stockQty)
          return {
            id: uid(),
            productId: item.productId,
            productName: item.name,
            type: 'sale' as const,
            quantity: stockQty,
            before: product.stock,
            after,
            note: `销售单 ${sale!.id.slice(0, 8)}`,
            createdAt: now(),
          }
        })

        return {
          products,
          sales: [sale, ...s.sales],
          stockLogs: [...logs, ...s.stockLogs],
        }
      })

      return sale
    },
    [],
  )

  const resetData = useCallback(() => {
    setState({ products: SEED_PRODUCTS, sales: [], stockLogs: [] })
  }, [])

  const revealDatabase = useCallback(async () => {
    if (window.desktopLedger) {
      return window.desktopLedger.reveal()
    }
    return ''
  }, [])

  const chooseSaveDatabasePath = useCallback(async () => {
    if (!window.desktopLedger) return null
    const result = await window.desktopLedger.chooseSavePath()
    if (result) applyDbSwitch(result)
    return result
  }, [applyDbSwitch])

  const chooseOpenDatabasePath = useCallback(async () => {
    if (!window.desktopLedger) return null
    const result = await window.desktopLedger.chooseOpenPath()
    if (result) applyDbSwitch(result)
    return result
  }, [applyDbSwitch])

  const resetDatabasePath = useCallback(async () => {
    if (!window.desktopLedger) return null
    const result = await window.desktopLedger.resetPath()
    applyDbSwitch(result)
    return result
  }, [applyDbSwitch])

  const findByScan = useCallback(
    (raw: string): { product: Product; pack: PackType } | null => {
      const code = normalizeScanCode(raw)
      const trimmed = raw.trim()
      if (!code && !trimmed) return null

      const byCase = snapshot.products.find(
        (p) =>
          p.caseBarcode &&
          (p.caseBarcode === code || p.caseBarcode === trimmed),
      )
      if (byCase) return { product: byCase, pack: 'case' }

      const byUnit = snapshot.products.find(
        (p) => p.barcode === code || p.barcode === trimmed,
      )
      if (byUnit) return { product: byUnit, pack: 'unit' }

      return null
    },
    [snapshot.products],
  )

  const findByBarcode = useCallback(
    (barcode: string) => findByScan(barcode)?.product,
    [findByScan],
  )

  const lowStockProducts = useMemo(
    () => snapshot.products.filter((p) => p.stock <= p.minStock),
    [snapshot.products],
  )

  return {
    ...snapshot,
    hydrated,
    dbPath: path,
    dbDefaultPath: defaultPath,
    dbIsCustom: isCustom,
    isDesktop: isDesktop(),
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    checkout,
    resetData,
    revealDatabase,
    chooseSaveDatabasePath,
    chooseOpenDatabasePath,
    resetDatabasePath,
    findByBarcode,
    findByScan,
    lowStockProducts,
  }
}

export function useTodayStats(sales: Sale[]) {
  return useMemo(() => {
    const today = new Date()
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime()

    const todaySales = sales.filter(
      (s) => new Date(s.createdAt).getTime() >= start,
    )
    const revenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    const count = todaySales.length
    const itemsSold = todaySales.reduce(
      (sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0),
      0,
    )
    return { revenue, count, itemsSold, todaySales }
  }, [sales])
}

export function formatMoney(n: number) {
  return `¥${n.toFixed(2)}`
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN')
}
