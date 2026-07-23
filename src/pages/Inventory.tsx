import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatMoney, formatTime, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

export function Inventory() {
  const { products, stockLogs, adjustStock, lowStockProducts, findByBarcode } =
    useAppStore()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [scan, setScan] = useState('')
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  /** 扫码后立即按数量确认出入库 */
  const [quickScan, setQuickScan] = useState(true)
  const scanRef = useRef<HTMLInputElement>(null)

  const selected = products.find((p) => p.id === productId)

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id)
  }, [products, productId])

  const filteredLogs = useMemo(() => {
    const q = filter.trim()
    if (!q) return stockLogs.slice(0, 50)
    return stockLogs
      .filter((l) => l.productName.includes(q) || l.note.includes(q))
      .slice(0, 50)
  }, [stockLogs, filter])

  function focusScan() {
    window.setTimeout(() => scanRef.current?.focus(), 30)
  }

  function applyStock(targetId: string, amount: number, tipNote?: string) {
    const product = products.find((p) => p.id === targetId)
    if (!product) return false

    if (type === 'in') {
      adjustStock(targetId, amount, 'in', tipNote || note || '扫码入库')
      setScanMsg(`已入库 ${product.name} ×${amount}`)
      return true
    }
    if (type === 'out') {
      if (amount > product.stock) {
        setScanMsg(`${product.name} 库存不足（剩 ${product.stock}）`)
        return false
      }
      adjustStock(targetId, -amount, 'out', tipNote || note || '扫码出库')
      setScanMsg(`已出库 ${product.name} ×${amount}`)
      return true
    }
    const delta = amount - product.stock
    adjustStock(targetId, delta, 'adjust', tipNote || note || '扫码盘点')
    setScanMsg(`已盘点 ${product.name} → ${amount}`)
    return true
  }

  function handleScan() {
    const code = normalizeScanCode(scan)
    setScan('')
    if (!code) return

    const product = findByBarcode(code)
    if (!product) {
      setScanMsg(`未找到条码/二维码：${code}（请先在商品管理中建档）`)
      focusScan()
      return
    }

    setProductId(product.id)
    const amount = Number(qty) || 1

    if (quickScan && type !== 'adjust') {
      applyStock(product.id, amount, type === 'in' ? '扫码入库' : '扫码出库')
    } else {
      setScanMsg(`已选中 ${product.name}，请确认数量后提交`)
    }
    focusScan()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId || !selected) return
    const n = Number(qty)
    if (!n || n <= 0) return

    const ok = applyStock(productId, n)
    if (!ok) return
    setNote('')
    if (type === 'adjust') setQty(String(selected.stock))
    focusScan()
  }

  const typeLabel = { in: '入库', out: '出库', adjust: '盘点', sale: '销售' }

  return (
    <div className="page">
      <div className="split-panels inventory-layout">
        <section className="panel">
          <header className="panel-head">
            <h2>库存调整</h2>
          </header>

          <div className="scan-bar inventory-scan">
            <input
              ref={scanRef}
              className="scan-input"
              placeholder="扫描外包装二维码/条码，回车识别"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleScan()
                }
              }}
            />
            <button type="button" className="btn primary" onClick={handleScan}>
              识别
            </button>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={quickScan}
              onChange={(e) => setQuickScan(e.target.checked)}
            />
            <span>扫码后立即按下方数量完成入库/出库（盘点除外）</span>
          </label>

          {scanMsg && <div className="toast warn">{scanMsg}</div>}

          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              商品
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.barcode}（库存 {p.stock}）
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <p className="muted">
                条码 <strong className="mono">{selected.barcode}</strong>
                ，当前库存{' '}
                <strong>
                  {selected.stock} {selected.unit}
                </strong>
                ，成本约 {formatMoney(selected.cost * selected.stock)}
              </p>
            )}

            <label>
              操作类型
              <div className="pay-tabs">
                {(
                  [
                    ['in', '入库'],
                    ['out', '出库'],
                    ['adjust', '盘点置数'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={`pay-tab${type === v ? ' active' : ''}`}
                    onClick={() => {
                      setType(v)
                      focusScan()
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>

            <label>
              {type === 'adjust' ? '盘点后数量' : '每次扫码数量'}
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>

            <label>
              备注
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="可选"
              />
            </label>

            <button type="submit" className="btn primary">
              确认调整
            </button>
          </form>

          {lowStockProducts.length > 0 && (
            <div className="low-stock-box">
              <h3>需补货</h3>
              <ul>
                {lowStockProducts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setProductId(p.id)
                        setType('in')
                        focusScan()
                      }}
                    >
                      {p.name}
                    </button>
                    <span>
                      {p.stock}/{p.minStock}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>库存流水</h2>
            <input
              className="search compact"
              placeholder="筛选商品"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </header>
          <div className="table-wrap compact">
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>商品</th>
                  <th>类型</th>
                  <th>数量</th>
                  <th>前后</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.createdAt)}</td>
                    <td>{log.productName}</td>
                    <td>
                      <span className={`badge soft ${log.type}`}>
                        {typeLabel[log.type]}
                      </span>
                    </td>
                    <td>{log.quantity}</td>
                    <td className="mono">
                      {log.before}→{log.after}
                    </td>
                    <td className="muted">{log.note}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      暂无流水记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
