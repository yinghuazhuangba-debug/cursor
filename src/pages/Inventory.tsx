import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { caseSalePrice, type PackType } from '../types'
import { formatMoney, formatTime, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

type MeasureMode = PackType | 'mixed'

export function Inventory() {
  const { products, stockLogs, adjustStock, lowStockProducts, findByScan } =
    useAppStore()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  /** 混合入库时的散装瓶数（不满一箱部分） */
  const [looseQty, setLooseQty] = useState('0')
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in')
  const [packMode, setPackMode] = useState<MeasureMode>('mixed')
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

  function calcBaseQty(
    productUnits: number,
    mode: MeasureMode,
    casesOrUnits: number,
    loose: number,
  ) {
    const perCase = Math.max(1, productUnits)
    if (mode === 'case') return casesOrUnits * perCase
    if (mode === 'mixed') return casesOrUnits * perCase + Math.max(0, loose)
    return casesOrUnits
  }

  function applyStock(
    targetId: string,
    mode: MeasureMode,
    casesOrUnits: number,
    loose: number,
    tipNote?: string,
  ) {
    const product = products.find((p) => p.id === targetId)
    if (!product) return false
    const perCase = Math.max(1, product.unitsPerCase || 1)
    const baseQty = calcBaseQty(perCase, mode, casesOrUnits, loose)
    if (baseQty <= 0 && type !== 'adjust') {
      setScanMsg('数量须大于 0')
      return false
    }

    if (type === 'in') {
      const label =
        mode === 'mixed'
          ? `入库 ${casesOrUnits}箱+${loose}${product.unit}(= ${baseQty}${product.unit})`
          : mode === 'case'
            ? `入库 ${casesOrUnits}箱(= ${baseQty}${product.unit})`
            : `入库 ${baseQty}${product.unit}`
      adjustStock(targetId, baseQty, 'in', tipNote || note || label)
      setScanMsg(`已入库 ${product.name} → +${baseQty}${product.unit}`)
      return true
    }

    if (type === 'out') {
      if (baseQty > product.stock) {
        setScanMsg(
          `${product.name} 库存不足（剩 ${product.stock}${product.unit}）`,
        )
        return false
      }
      const label =
        mode === 'mixed'
          ? `出库 ${casesOrUnits}箱+${loose}${product.unit}(= ${baseQty}${product.unit})`
          : mode === 'case'
            ? `出库 ${casesOrUnits}箱(= ${baseQty}${product.unit})`
            : `出库 ${baseQty}${product.unit}`
      adjustStock(targetId, -baseQty, 'out', tipNote || note || label)
      setScanMsg(`已出库 ${product.name} → -${baseQty}${product.unit}`)
      return true
    }

    const delta = casesOrUnits - product.stock
    adjustStock(targetId, delta, 'adjust', tipNote || note || '盘点')
    setScanMsg(`已盘点 ${product.name} → ${casesOrUnits}${product.unit}`)
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

    // 扫箱码默认「整箱+散装」便于补零头；扫瓶码默认按瓶（适合不满一箱）
    if (pack === 'case') {
      setPackMode(product.unitsPerCase > 1 ? 'mixed' : 'case')
      setQty('1')
      setLooseQty('0')
    } else {
      setPackMode('unit')
      setQty('1')
      setLooseQty('0')
    }

    const amount = Number(qty) || 1

    if (quickScan && type !== 'adjust') {
      // 扫箱码快速入 1 箱；扫瓶码快速入 1 瓶（不满一箱场景）
      applyStock(
        product.id,
        pack === 'case' ? 'case' : 'unit',
        pack === 'case' ? 1 : amount,
        0,
        pack === 'case'
          ? type === 'in'
            ? '扫箱码入库'
            : '扫箱码出库'
          : type === 'in'
            ? '扫瓶码入库（散装/不满箱）'
            : '扫瓶码出库',
      )
    } else {
      setScanMsg(
        pack === 'case'
          ? `识别为【箱码】${product.name}（1箱=${product.unitsPerCase}${product.unit}）。不满一箱请用「整箱+散装」填写零头。`
          : `识别为【瓶码】${product.name}。不满一箱可直接按${product.unit}录入数量。`,
      )
    }
    focusScan()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId || !selected) return
    const n = Number(qty)
    const loose = Number(looseQty) || 0
    if (type === 'adjust') {
      if (n < 0) return
      const ok = applyStock(productId, 'unit', n, 0)
      if (!ok) return
    } else {
      if (packMode === 'mixed') {
        if ((n || 0) < 0 || loose < 0) return
        if ((n || 0) + loose <= 0) {
          setScanMsg('请填写箱数和/或散装数量')
          return
        }
        if (loose >= units) {
          setScanMsg(
            `散装数量应小于一箱（${units}${selected.unit}）。满箱请计入箱数。`,
          )
          return
        }
      } else if (!n || n <= 0) {
        return
      }
      const ok = applyStock(productId, packMode, n || 0, loose)
      if (!ok) return
    }
    setNote('')
    if (type === 'adjust') setQty(String(selected.stock))
    else {
      setQty(packMode === 'unit' ? '1' : '0')
      setLooseQty('0')
    }
    focusScan()
  }

  const typeLabel = { in: '入库', out: '出库', adjust: '盘点', sale: '销售' }
  const previewBase =
    type === 'adjust'
      ? Number(qty) || 0
      : calcBaseQty(units, packMode, Number(qty) || 0, Number(looseQty) || 0)

  return (
    <div className="page">
      <div className="split-panels inventory-layout">
        <section className="panel">
          <header className="panel-head">
            <h2>库存调整</h2>
          </header>

          <div className="rule-box">
            <strong>不满一箱怎么入？</strong>
            <ul>
              <li>
                <b>整箱</b>：扫箱码，或计量选「按箱」
              </li>
              <li>
                <b>零散/不满箱</b>：扫瓶码按{selected?.unit || '瓶'}入，或选「整箱+散装」填零头
              </li>
              <li>
                例：到货 2 箱零 5 瓶 → 箱数填 2，散装填 5（箱规 24 则库存 +53 瓶）
              </li>
            </ul>
          </div>

          <div className="scan-bar inventory-scan">
            <input
              ref={scanRef}
              className="scan-input"
              placeholder="扫箱码入整箱 / 扫瓶码入散装（不满箱）"
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
                  瓶码 <span className="mono">{selected.barcode}</span>
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
                <div className="pay-tabs three">
                  <button
                    type="button"
                    className={`pay-tab${packMode === 'mixed' ? ' active' : ''}`}
                    onClick={() => setPackMode('mixed')}
                  >
                    整箱+散装
                  </button>
                  <button
                    type="button"
                    className={`pay-tab${packMode === 'case' ? ' active' : ''}`}
                    onClick={() => setPackMode('case')}
                  >
                    仅按箱
                  </button>
                  <button
                    type="button"
                    className={`pay-tab${packMode === 'unit' ? ' active' : ''}`}
                    onClick={() => setPackMode('unit')}
                  >
                    仅按{selected?.unit || '瓶'}
                  </button>
                </div>
              </label>
            )}

            {type === 'adjust' ? (
              <label>
                盘点后库存（{selected?.unit || '瓶'}）
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </label>
            ) : packMode === 'mixed' ? (
              <div className="mixed-qty">
                <label>
                  整箱数
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <label>
                  散装（不满一箱，{selected?.unit || '瓶'}）
                  <input
                    type="number"
                    min="0"
                    max={Math.max(0, units - 1)}
                    step="1"
                    value={looseQty}
                    onChange={(e) => setLooseQty(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <label>
                {packMode === 'case'
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
            )}

            {type !== 'adjust' && selected && (
              <p className="muted">
                将{type === 'in' ? '增加' : '减少'}库存{' '}
                <strong>
                  {previewBase} {selected.unit}
                </strong>
                {packMode === 'mixed' && units > 1 && (
                  <>
                    {' '}
                    （{(Number(qty) || 0)} 箱 × {units} +{' '}
                    {Number(looseQty) || 0} 散装）
                  </>
                )}
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
                        setPackMode(p.unitsPerCase > 1 ? 'mixed' : 'unit')
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
