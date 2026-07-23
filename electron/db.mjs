import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import initSqlJs from 'sql.js'
import { SEED_PRODUCTS } from './seed.mjs'

const require = createRequire(import.meta.url)

/** @type {import('sql.js').Database | null} */
let db = null
let dbPath = ''

export function getDbPath() {
  return dbPath
}

function persistFile() {
  if (!db || !dbPath) return
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

export async function initDatabase() {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  dbPath = path.join(dir, 'ledger.db')

  const wasmPath = path.join(
    path.dirname(require.resolve('sql.js')),
    'sql-wasm.wasm',
  )
  const wasmBinary = fs.readFileSync(wasmPath)
  const SQL = await initSqlJs({ wasmBinary })

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }

  exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
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

  const row = get('SELECT COUNT(*) AS n FROM products')
  if (!row || Number(row.n) === 0) {
    saveState({
      products: SEED_PRODUCTS,
      sales: [],
      stockLogs: [],
    })
  } else {
    persistFile()
  }

  return dbPath
}

function mapProduct(row) {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
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

  return { products, sales, stockLogs }
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
          id, barcode, name, category, price, cost, stock, unit, min_stock, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.barcode,
          p.name,
          p.category,
          p.price,
          p.cost,
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
          `INSERT INTO sale_items (sale_id, product_id, name, price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            item.productId,
            item.name,
            item.price,
            item.quantity,
            item.subtotal,
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
