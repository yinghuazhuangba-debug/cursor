import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { SEED_PRODUCTS } from '../data/seed'
import type {
  AppState,
  CartItem,
  Product,
  Sale,
  StockLog,
} from '../types'

const STORAGE_KEY = 'xianlin-supermarket-v1'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.products?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return { products: SEED_PRODUCTS, sales: [], stockLogs: [] }
}

let state: AppState = loadState()
const listeners = new Set<() => void>()

function emit() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  listeners.forEach((l) => l())
}

function setState(next: AppState | ((prev: AppState) => AppState)) {
  state = typeof next === 'function' ? next(state) : next
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

export function useAppStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const addProduct = useCallback(
    (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
      const product: Product = {
        ...data,
        id: uid(),
        createdAt: now(),
        updatedAt: now(),
      }
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
          p.id === id ? { ...p, ...patch, updatedAt: now() } : p,
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
          const idx = products.findIndex((p) => p.id === item.productId)
          if (idx >= 0) {
            products[idx] = {
              ...products[idx],
              stock: Math.max(0, products[idx].stock - item.quantity),
              updatedAt: now(),
            }
          }
          return {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: +(item.price * item.quantity).toFixed(2),
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
          const after = Math.max(0, product.stock - item.quantity)
          return {
            id: uid(),
            productId: item.productId,
            productName: item.name,
            type: 'sale' as const,
            quantity: item.quantity,
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

  const findByBarcode = useCallback(
    (barcode: string) =>
      snapshot.products.find((p) => p.barcode === barcode.trim()),
    [snapshot.products],
  )

  const lowStockProducts = useMemo(
    () => snapshot.products.filter((p) => p.stock <= p.minStock),
    [snapshot.products],
  )

  return {
    ...snapshot,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    checkout,
    resetData,
    findByBarcode,
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
