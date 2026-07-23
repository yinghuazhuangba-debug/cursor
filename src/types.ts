export type Category = string

/** pack: unit=按最小单位(瓶), case=按箱 */
export type PackType = 'unit' | 'case'

export interface Product {
  id: string
  /** 零售码 / 瓶码 */
  barcode: string
  /** 箱码（可选） */
  caseBarcode: string
  /** 一箱含多少最小单位，如 24 瓶 */
  unitsPerCase: number
  name: string
  category: Category
  /** 最小单位售价（瓶价） */
  price: number
  /** 最小单位进价 */
  cost: number
  /** 整箱售价；为 0 时按 瓶价×箱规 计算 */
  casePrice: number
  /** 库存始终按最小单位计数（瓶数） */
  stock: number
  /** 最小单位名称，如 瓶/袋 */
  unit: string
  minStock: number
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  /** 扣减库存的最小单位数量；默认 quantity */
  stockQty?: number
  pack?: PackType
}

export interface SaleItem {
  productId: string
  name: string
  price: number
  quantity: number
  subtotal: number
  stockQty?: number
  pack?: PackType
}

export interface Sale {
  id: string
  items: SaleItem[]
  total: number
  paid: number
  change: number
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'card'
  createdAt: string
}

export interface StockLog {
  id: string
  productId: string
  productName: string
  type: 'in' | 'out' | 'adjust' | 'sale'
  quantity: number
  before: number
  after: number
  note: string
  createdAt: string
}

export interface AppState {
  products: Product[]
  sales: Sale[]
  stockLogs: StockLog[]
  categories: string[]
}

/** 默认分类，可在商品管理中手动维护 */
export const DEFAULT_CATEGORIES: string[] = [
  '饮料',
  '零食',
  '日用品',
  '生鲜',
  '粮油',
  '其他',
]

/** @deprecated 使用 DEFAULT_CATEGORIES / store.categories */
export const CATEGORIES = DEFAULT_CATEGORIES

export const PAYMENT_LABELS: Record<Sale['paymentMethod'], string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
}

export function caseSalePrice(p: Product): number {
  if (p.casePrice > 0) return p.casePrice
  return +(p.price * Math.max(1, p.unitsPerCase || 1)).toFixed(2)
}

export function normalizeProduct(p: Partial<Product> & Pick<Product, 'id' | 'barcode' | 'name'>): Product {
  const now = new Date().toISOString()
  return {
    id: p.id,
    barcode: p.barcode,
    caseBarcode: p.caseBarcode ?? '',
    unitsPerCase: Math.max(1, Number(p.unitsPerCase) || 1),
    name: p.name,
    category: (p.category as Category) || '其他',
    price: Number(p.price) || 0,
    cost: Number(p.cost) || 0,
    casePrice: Number(p.casePrice) || 0,
    stock: Number(p.stock) || 0,
    unit: p.unit || '件',
    minStock: Number(p.minStock) || 0,
    createdAt: p.createdAt || now,
    updatedAt: p.updatedAt || now,
  }
}

export function normalizeCategories(list?: string[] | null): string[] {
  const base = Array.isArray(list) && list.length ? list : DEFAULT_CATEGORIES
  const cleaned = base
    .map((c) => String(c || '').trim())
    .filter(Boolean)
  const uniq = [...new Set(cleaned)]
  if (!uniq.includes('其他')) uniq.push('其他')
  return uniq
}
