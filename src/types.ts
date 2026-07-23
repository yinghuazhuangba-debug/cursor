export type Category =
  | '饮料'
  | '零食'
  | '日用品'
  | '生鲜'
  | '粮油'
  | '其他'

export interface Product {
  id: string
  barcode: string
  name: string
  category: Category
  price: number
  cost: number
  stock: number
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
}

export interface SaleItem {
  productId: string
  name: string
  price: number
  quantity: number
  subtotal: number
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
}

export const CATEGORIES: Category[] = [
  '饮料',
  '零食',
  '日用品',
  '生鲜',
  '粮油',
  '其他',
]

export const PAYMENT_LABELS: Record<Sale['paymentMethod'], string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
}
