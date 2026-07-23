import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import initSqlJs from 'sql.js'
import { SEED_PRODUCTS } from './seed.mjs'
import {
  getConfiguredDbPath,
  getDefaultDbPath,
  writeSettings,
} from './config.mjs'

const require = createRequire(import.meta.url)

/** @type {import('sql.js').Database | null} */
let db = null
let dbPath = ''
/** @type {Awaited<ReturnType<typeof initSqlJs>> | null} */
let SQL = null

export function getDbPath() {
  return dbPath
}

export function getDbInfo() {
  const current = dbPath || getConfiguredDbPath()
  const defaultPath = getDefaultDbPath()
  return {
    path: current,
    defaultPath,
    isCustom: path.resolve(current) !== path.resolve(defaultPath),
  }
}

function persistFile() {
  if (!db || !dbPath) return
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function exec(sql) {
  db.run(sql)
}

function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return undefined
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function run(sql, params = []) {
  db.run(sql, params)
}

async function ensureSql() {
  if (SQL) return SQL
  const wasmPath = path.join(
    path.dirname(require.resolve('sql.js')),
    'sql-wasm.wasm',
  )
  const wasmBinary = fs.readFileSync(wasmPath)
  SQL = await initSqlJs({ wasmBinary })
  return SQL
}

function ensureSchema() {
  exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      case_barcode TEXT NOT NULL DEFAULT '',
      units_per_case INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      case_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL,
      unit TEXT NOT NULL,
      min_stock INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      total REAL NOT NULL,
      paid REAL NOT NULL,
      change_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      before_qty INTEGER NOT NULL,
      after_qty INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  // 兼容旧库：补齐箱码/箱规字段
  const cols = all(`PRAGMA table_info(products)`).map((c) => c.name)
  if (!cols.includes('case_barcode')) {
    exec(`ALTER TABLE products ADD COLUMN case_barcode TEXT NOT NULL DEFAULT ''`)
  }
  if (!cols.includes('units_per_case')) {
    exec(`ALTER TABLE products ADD COLUMN units_per_case INTEGER NOT NULL DEFAULT 1`)
  }
  if (!cols.includes('case_price')) {
    exec(`ALTER TABLE products ADD COLUMN case_price REAL NOT NULL DEFAULT 0`)
  }

  const saleItemCols = all(`PRAGMA table_info(sale_items)`).map((c) => c.name)
  if (!saleItemCols.includes('unit_cost')) {
    exec(`ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0`)
  }
  if (!saleItemCols.includes('cost_subtotal')) {
    exec(
      `ALTER TABLE sale_items ADD COLUMN cost_subtotal REAL NOT NULL DEFAULT 0`,
    )
  }
  if (!saleItemCols.includes('stock_qty')) {
    exec(`ALTER TABLE sale_items ADD COLUMN stock_qty INTEGER`)
  }
  if (!saleItemCols.includes('pack')) {
    exec(`ALTER TABLE sale_items ADD COLUMN pack TEXT`)
  }
}

function openAt(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  dbPath = targetPath
  if (fs.existsSync(targetPath)) {
    db = new SQL.Database(fs.readFileSync(targetPath))
  } else {
    db = new SQL.Database()
  }
  ensureSchema()
  const row = get('SELECT COUNT(*) AS n FROM products')
  if (!row || Number(row.n) === 0) {
    saveState({
      products: SEED_PRODUCTS,
      sales: [],
      stockLogs: [],
      categories: ['饮料', '零食', '日用品', '生鲜', '粮油', '其他'],
    })
  } else {
    persistFile()
  }
}

export async function initDatabase() {
  await ensureSql()
  // touch userData so settings can live there
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  openAt(getConfiguredDbPath())
  return dbPath
}

/**
 * Switch database file.
 * @param {string} nextPath
 * @param {{ mode: 'copy' | 'open' | 'fresh' }} options
 */
export async function switchDatabase(nextPath, options = { mode: 'copy' }) {
  await ensureSql()
  const resolved = path.resolve(nextPath)
  if (!resolved.toLowerCase().endsWith('.db')) {
    throw new Error('数据库文件需以 .db 结尾')
  }

  // Flush current memory first
  if (db) persistFile()

  const previous = dbPath
  const mode = options.mode || 'copy'

  if (mode === 'copy' && previous && fs.existsSync(previous)) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    if (path.resolve(previous) !== resolved) {
      fs.copyFileSync(previous, resolved)
    }
  }

  if (db) {
    db.close()
    db = null
  }

  if (mode === 'fresh' && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved)
  }

  if (path.resolve(resolved) === path.resolve(getDefaultDbPath())) {
    writeSettings({ dbPath: null })
  } else {
    writeSettings({ dbPath: resolved })
  }

  openAt(resolved)
  return getDbInfo()
}

export async function resetDatabasePath() {
  return switchDatabase(getDefaultDbPath(), { mode: 'open' })
}

function mapProduct(row) {
  return {
    id: row.id,
    barcode: row.barcode,
    caseBarcode: row.case_barcode || '',
    unitsPerCase: Math.max(1, Number(row.units_per_case) || 1),
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    casePrice: Number(row.case_price) || 0,
    stock: row.stock,
    unit: row.unit,
    minStock: row.min_stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapLog(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    type: row.type,
    quantity: row.quantity,
    before: row.before_qty,
    after: row.after_qty,
    note: row.note,
    createdAt: row.created_at,
  }
}

export function loadState() {
  const products = all(
    'SELECT * FROM products ORDER BY created_at ASC',
  ).map(mapProduct)

  const salesRows = all('SELECT * FROM sales ORDER BY created_at DESC')
  const sales = salesRows.map((row) => ({
    id: row.id,
    items: all(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC',
      [row.id],
    ).map((item) => ({
      productId: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      stockQty: item.stock_qty ?? item.quantity,
      pack: item.pack || undefined,
      unitCost: Number(item.unit_cost) || 0,
      costSubtotal: Number(item.cost_subtotal) || 0,
    })),
    total: row.total,
    paid: row.paid,
    change: row.change_amount,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  }))

  const stockLogs = all(
    'SELECT * FROM stock_logs ORDER BY created_at DESC',
  ).map(mapLog)

  const catRow = get(`SELECT value FROM meta WHERE key = 'categories'`)
  let categories = ['饮料', '零食', '日用品', '生鲜', '粮油', '其他']
  if (catRow?.value) {
    try {
      const parsed = JSON.parse(String(catRow.value))
      if (Array.isArray(parsed) && parsed.length) categories = parsed
    } catch {
      /* ignore */
    }
  }
  // 合并商品里已有分类
  for (const p of products) {
    if (p.category && !categories.includes(p.category)) {
      categories.push(p.category)
    }
  }
  if (!categories.includes('其他')) categories.push('其他')

  return { products, sales, stockLogs, categories }
}

export function saveState(state) {
  exec('BEGIN')
  try {
    exec('DELETE FROM sale_items')
    exec('DELETE FROM sales')
    exec('DELETE FROM stock_logs')
    exec('DELETE FROM products')

    for (const p of state.products) {
      run(
        `INSERT INTO products (
          id, barcode, case_barcode, units_per_case, name, category,
          price, cost, case_price, stock, unit, min_stock, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.barcode,
          p.caseBarcode || '',
          Math.max(1, Number(p.unitsPerCase) || 1),
          p.name,
          p.category,
          p.price,
          p.cost,
          Number(p.casePrice) || 0,
          p.stock,
          p.unit,
          p.minStock,
          p.createdAt,
          p.updatedAt,
        ],
      )
    }

    for (const s of state.sales) {
      run(
        `INSERT INTO sales (id, total, paid, change_amount, payment_method, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.total, s.paid, s.change, s.paymentMethod, s.createdAt],
      )
      for (const item of s.items) {
        run(
          `INSERT INTO sale_items (
            sale_id, product_id, name, price, quantity, subtotal,
            unit_cost, cost_subtotal, stock_qty, pack
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            item.productId,
            item.name,
            item.price,
            item.quantity,
            item.subtotal,
            Number(item.unitCost) || 0,
            Number(item.costSubtotal) || 0,
            item.stockQty ?? item.quantity,
            item.pack || null,
          ],
        )
      }
    }

    for (const log of state.stockLogs) {
      run(
        `INSERT INTO stock_logs (
          id, product_id, product_name, type, quantity, before_qty, after_qty, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.id,
          log.productId,
          log.productName,
          log.type,
          log.quantity,
          log.before,
          log.after,
          log.note,
          log.createdAt,
        ],
      )
    }

    run(
      `INSERT INTO meta (key, value) VALUES ('updated_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [new Date().toISOString()],
    )

    const categories = Array.isArray(state.categories)
      ? state.categories
      : ['饮料', '零食', '日用品', '生鲜', '粮油', '其他']
    run(
      `INSERT INTO meta (key, value) VALUES ('categories', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [JSON.stringify(categories)],
    )

    exec('COMMIT')
    persistFile()
  } catch (err) {
    exec('ROLLBACK')
    throw err
  }
}

export function closeDatabase() {
  if (db) {
    persistFile()
    db.close()
    db = null
  }
}
