import type { Product, Sale } from '../types'

export interface PeriodStats {
  revenue: number
  cost: number
  profit: number
  orders: number
  itemsSold: number
  margin: number
}

export interface DailyRow {
  date: string
  revenue: number
  cost: number
  profit: number
  orders: number
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function endOfLocalDay(d: Date) {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999,
  ).getTime()
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function toDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayRange(now = new Date()) {
  return { start: startOfLocalDay(now), end: endOfLocalDay(now) }
}

export function monthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).getTime()
  return { start, end }
}

export function yearRange(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1).getTime()
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime()
  return { start, end }
}

export function customRange(from: string, to: string) {
  const a = parseDateInput(from)
  const b = parseDateInput(to)
  if (!a || !b) return null
  const start = startOfLocalDay(a <= b ? a : b)
  const end = endOfLocalDay(a <= b ? b : a)
  return { start, end }
}

function itemCost(item: Sale['items'][number], products: Product[]) {
  if (typeof item.costSubtotal === 'number' && item.costSubtotal > 0) {
    return item.costSubtotal
  }
  if (typeof item.unitCost === 'number' && item.unitCost > 0) {
    const qty = item.stockQty ?? item.quantity
    return +(item.unitCost * qty).toFixed(2)
  }
  const product = products.find((p) => p.id === item.productId)
  if (!product) return 0
  const qty = item.stockQty ?? item.quantity
  return +(product.cost * qty).toFixed(2)
}

export function saleCost(sale: Sale, products: Product[]) {
  return +sale.items
    .reduce((sum, item) => sum + itemCost(item, products), 0)
    .toFixed(2)
}

export function computeStats(
  sales: Sale[],
  products: Product[],
  start: number,
  end: number,
): PeriodStats {
  const inRange = sales.filter((s) => {
    const t = new Date(s.createdAt).getTime()
    return t >= start && t <= end
  })

  const revenue = +inRange.reduce((sum, s) => sum + s.total, 0).toFixed(2)
  const cost = +inRange
    .reduce((sum, s) => sum + saleCost(s, products), 0)
    .toFixed(2)
  const profit = +(revenue - cost).toFixed(2)
  const orders = inRange.length
  const itemsSold = inRange.reduce(
    (sum, s) =>
      sum + s.items.reduce((n, i) => n + (i.stockQty ?? i.quantity), 0),
    0,
  )
  const margin = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0

  return { revenue, cost, profit, orders, itemsSold, margin }
}

export function dailyBreakdown(
  sales: Sale[],
  products: Product[],
  start: number,
  end: number,
): DailyRow[] {
  const map = new Map<string, DailyRow>()

  for (const sale of sales) {
    const t = new Date(sale.createdAt).getTime()
    if (t < start || t > end) continue
    const key = toDateInputValue(new Date(sale.createdAt))
    const row = map.get(key) || {
      date: key,
      revenue: 0,
      cost: 0,
      profit: 0,
      orders: 0,
    }
    const c = saleCost(sale, products)
    row.revenue = +(row.revenue + sale.total).toFixed(2)
    row.cost = +(row.cost + c).toFixed(2)
    row.profit = +(row.revenue - row.cost).toFixed(2)
    row.orders += 1
    map.set(key, row)
  }

  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}
