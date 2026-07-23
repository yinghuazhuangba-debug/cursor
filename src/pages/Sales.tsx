import { useMemo, useState } from 'react'
import { PAYMENT_LABELS } from '../types'
import { formatMoney, formatTime, useAppStore } from '../store/useStore'

export function Sales() {
  const { sales } = useAppStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [method, setMethod] = useState<string>('全部')
  const [dateFilter, setDateFilter] = useState('')

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const matchMethod =
        method === '全部' || s.paymentMethod === method
      const matchDate =
        !dateFilter || s.createdAt.slice(0, 10) === dateFilter
      return matchMethod && matchDate
    })
  }, [sales, method, dateFilter])

  const sum = filtered.reduce((n, s) => n + s.total, 0)

  return (
    <div className="page">
      <div className="toolbar">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="全部">全部支付方式</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <div className="toolbar-stat">
          共 {filtered.length} 笔 · {formatMoney(sum)}
        </div>
      </div>

      <div className="sales-list">
        {filtered.length === 0 && (
          <p className="empty">暂无销售记录，去收银台开第一单吧。</p>
        )}
        {filtered.map((sale) => {
          const open = expanded === sale.id
          return (
            <article key={sale.id} className="sale-card">
              <button
                type="button"
                className="sale-head"
                onClick={() => setExpanded(open ? null : sale.id)}
              >
                <div>
                  <strong>{formatMoney(sale.total)}</strong>
                  <span className="muted">
                    {PAYMENT_LABELS[sale.paymentMethod]} ·{' '}
                    {sale.items.reduce((n, i) => n + i.quantity, 0)} 件
                  </span>
                </div>
                <div className="sale-meta">
                  <span>{formatTime(sale.createdAt)}</span>
                  <span className="chevron">{open ? '▾' : '▸'}</span>
                </div>
              </button>
              {open && (
                <div className="sale-body">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>商品</th>
                        <th>单价</th>
                        <th>数量</th>
                        <th>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items.map((item) => (
                        <tr key={item.productId + item.name}>
                          <td>{item.name}</td>
                          <td>{formatMoney(item.price)}</td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted sale-foot">
                    实收 {formatMoney(sale.paid)} · 找零{' '}
                    {formatMoney(sale.change)} · 单号{' '}
                    {sale.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
