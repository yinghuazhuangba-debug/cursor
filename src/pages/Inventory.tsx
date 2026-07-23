import { useMemo, useState, type FormEvent } from 'react'
import { formatMoney, formatTime, useAppStore } from '../store/useStore'

export function Inventory() {
  const { products, stockLogs, adjustStock, lowStockProducts } = useAppStore()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('10')
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')

  const selected = products.find((p) => p.id === productId)

  const filteredLogs = useMemo(() => {
    const q = filter.trim()
    if (!q) return stockLogs.slice(0, 50)
    return stockLogs
      .filter((l) => l.productName.includes(q) || l.note.includes(q))
      .slice(0, 50)
  }, [stockLogs, filter])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId || !selected) return
    const n = Number(qty)
    if (!n || n <= 0) return

    if (type === 'in') {
      adjustStock(productId, n, 'in', note || '进货入库')
    } else if (type === 'out') {
      if (n > selected.stock) {
        alert('出库数量超过当前库存')
        return
      }
      adjustStock(productId, -n, 'out', note || '出库')
    } else {
      const delta = n - selected.stock
      adjustStock(productId, delta, 'adjust', note || '盘点调整')
    }
    setNote('')
    setQty(type === 'adjust' ? String(selected.stock) : '10')
  }

  const typeLabel = { in: '入库', out: '出库', adjust: '盘点', sale: '销售' }

  return (
    <div className="page">
      <div className="split-panels inventory-layout">
        <section className="panel">
          <header className="panel-head">
            <h2>库存调整</h2>
          </header>
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              商品
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（库存 {p.stock}）
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <p className="muted">
                当前库存{' '}
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
                    onClick={() => setType(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>

            <label>
              {type === 'adjust' ? '盘点后数量' : '数量'}
              <input
                type="number"
                min="0"
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
