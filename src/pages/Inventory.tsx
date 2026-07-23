import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { caseSalePrice, type PackType } from '../types'
import { formatMoney, formatTime, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

export function Inventory() {
  const { products, stockLogs, adjustStock, lowStockProducts, findByScan } =
    useAppStore()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in')
  const [packMode, setPackMode] = useState<PackType>('case')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [scan, setScan] = useState('')
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [quickScan, setQuickScan] = useState(true)
  const scanRef = useRef<HTMLInputElement>(null)

  const selected = products.find((p) => p.id === productId)
  const units = Math.max(1, selected?.unitsPerCase || 1)

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

  function toBaseQty(amount: number, pack: PackType) {
    if (pack === 'case') return amount * Math.max(1, selected?.unitsPerCase || 1)
    return amount
  }

  function applyStock(
    targetId: string,
    packAmount: number,
    pack: PackType,
    tipNote?: string,
  ) {
    const product = products.find((p) => p.id === targetId)
    if (!product) return false
    const perCase = Math.max(1, product.unitsPerCase || 1)
    const baseQty =
      pack === 'case' ? packAmount * perCase : packAmount

    if (type === 'in') {
      const label =
        pack === 'case'
          ? `扫码入库 ${packAmount}箱(= ${baseQty}${product.unit})`
          : `扫码入库 ${baseQty}${product.unit}`
      adjustStock(targetId, baseQty, 'in', tipNote || note || label)
      setScanMsg(
        pack === 'case'
          ? `已入库 ${product.name} ${packAmount}箱 → +${baseQty}${product.unit}`
          : `已入库 ${product.name} +${baseQty}${product.unit}`,
      )
      return true
    }

    if (type === 'out') {
      if (baseQty > product.stock) {
        setScanMsg(`${product.name} 库存不足（剩 ${product.stock}${product.unit}）`)
        return false
      }
      const label =
        pack === 'case'
          ? `扫码出库 ${packAmount}箱(= ${baseQty}${product.unit})`
          : `扫码出库 ${baseQty}${product.unit}`
      adjustStock(targetId, -baseQty, 'out', tipNote || note || label)
      setScanMsg(
        pack === 'case'
          ? `已出库 ${product.name} ${packAmount}箱 → -${baseQty}${product.unit}`
          : `已出库 ${product.name} -${baseQty}${product.unit}`,
      )
      return true
    }

    // adjust: amount is always base units target stock
    const delta = packAmount - product.stock
    adjustStock(targetId, delta, 'adjust', tipNote || note || '扫码盘点')
    setScanMsg(`已盘点 ${product.name} → ${packAmount}${product.unit}`)
    return true
  }

  function handleScan() {
    const code = normalizeScanCode(scan)
    setScan('')
    if (!code) return

    const hit = findByScan(code)
    if (!hit) {
      setScanMsg(`未找到条码/箱码：${code}（请先在商品管理建档）`)
      focusScan()
      return
    }

    const { product, pack } = hit
    setProductId(product.id)
    setPackMode(pack)
    const amount = Number(qty) || 1

    if (quickScan && type !== 'adjust') {
      applyStock(
        product.id,
        amount,
        pack,
        pack === 'case'
          ? type === 'in'
            ? '扫箱码入库'
            : '扫箱码出库'
          : type === 'in'
            ? '扫瓶码入库'
            : '扫瓶码出库',
      )
    } else {
      setScanMsg(
        pack === 'case'
          ? `识别为【箱码】${product.name}（1箱=${product.unitsPerCase}${product.unit}）`
          : `识别为【瓶/零售码】${product.name}，单价 ${formatMoney(product.price)}`,
      )
    }
    focusScan()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId || !selected) return
    const n = Number(qty)
    if (!n || n <= 0) return

    const pack = type === 'adjust' ? 'unit' : packMode
    const ok = applyStock(productId, n, pack)
    if (!ok) return
    setNote('')
    if (type === 'adjust') setQty(String(selected.stock))
    focusScan()
  }

  const typeLabel = { in: '入库', out: '出库', adjust: '盘点', sale: '销售' }
  const previewBase =
    type === 'adjust'
      ? Number(qty) || 0
      : toBaseQty(Number(qty) || 0, packMode)

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
              placeholder="扫箱码按箱入库 / 扫瓶码按瓶入库"
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
            <span>扫码后立即按数量完成入库/出库（盘点除外）</span>
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
                    {p.name} · 瓶码{p.barcode}
                    {p.caseBarcode ? ` / 箱码${p.caseBarcode}` : ''}（库存{' '}
                    {p.stock}
                    {p.unit}）
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="pack-hint">
                <p>
                  库存按<strong>{selected.unit}</strong>计：当前{' '}
                  <strong>
                    {selected.stock} {selected.unit}
                  </strong>
                  {selected.unitsPerCase > 1 && (
                    <>
                      {' '}
                      ≈ {(selected.stock / selected.unitsPerCase).toFixed(1)} 箱
                    </>
                  )}
                </p>
                <p className="muted">
                  瓶/零售码 <span className="mono">{selected.barcode}</span>
                  {selected.caseBarcode ? (
                    <>
                      {' '}
                      · 箱码{' '}
                      <span className="mono">{selected.caseBarcode}</span> · 箱规{' '}
                      {selected.unitsPerCase}
                      {selected.unit}/箱
                    </>
                  ) : (
                    ' · 未设置箱码'
                  )}
                </p>
                <p className="muted">
                  瓶价 {formatMoney(selected.price)}
                  {selected.unitsPerCase > 1 && (
                    <> · 箱价 {formatMoney(caseSalePrice(selected))}</>
                  )}
                </p>
              </div>
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

            {type !== 'adjust' && (
              <label>
                计量方式
                <div className="pay-tabs">
                  <button
                    type="button"
                    className={`pay-tab${packMode === 'case' ? ' active' : ''}`}
                    onClick={() => setPackMode('case')}
                  >
                    按箱（×{units}）
                  </button>
                  <button
                    type="button"
                    className={`pay-tab${packMode === 'unit' ? ' active' : ''}`}
                    onClick={() => setPackMode('unit')}
                  >
                    按{selected?.unit || '瓶'}
                  </button>
                </div>
              </label>
            )}

            <label>
              {type === 'adjust'
                ? `盘点后库存（${selected?.unit || '瓶'}）`
                : packMode === 'case'
                  ? '箱数'
                  : `数量（${selected?.unit || '瓶'}）`}
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>

            {type !== 'adjust' && selected && (
              <p className="muted">
                将{type === 'in' ? '增加' : '减少'}库存{' '}
                <strong>
                  {previewBase} {selected.unit}
                </strong>
              </p>
            )}

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
                        setPackMode(p.caseBarcode ? 'case' : 'unit')
                        focusScan()
                      }}
                    >
                      {p.name}
                    </button>
                    <span>
                      {p.stock}/{p.minStock}
                      {p.unit}
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
