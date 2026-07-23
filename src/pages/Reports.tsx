import { useMemo, useState } from 'react'
import { formatMoney, useAppStore } from '../store/useStore'
import {
  computeStats,
  customRange,
  dailyBreakdown,
  monthRange,
  toDateInputValue,
  todayRange,
  yearRange,
  type PeriodStats,
} from '../utils/report'

type Preset = 'today' | 'month' | 'year' | 'custom'

function StatCards({
  title,
  stats,
}: {
  title: string
  stats: PeriodStats
}) {
  return (
    <section className="panel report-block">
      <header className="panel-head">
        <h2>{title}</h2>
        <span className="muted">
          {stats.orders} 笔 · 售出 {stats.itemsSold} 件 · 毛利率 {stats.margin}%
        </span>
      </header>
      <div className="report-metrics">
        <article>
          <span>销售额</span>
          <strong>{formatMoney(stats.revenue)}</strong>
        </article>
        <article>
          <span>利润</span>
          <strong className={stats.profit >= 0 ? 'up' : 'down'}>
            {formatMoney(stats.profit)}
          </strong>
        </article>
        <article>
          <span>成本</span>
          <strong>{formatMoney(stats.cost)}</strong>
        </article>
      </div>
    </section>
  )
}

export function Reports() {
  const { sales, products } = useAppStore()
  const now = useMemo(() => new Date(), [])
  const [preset, setPreset] = useState<Preset>('today')
  const [from, setFrom] = useState(toDateInputValue(now))
  const [to, setTo] = useState(toDateInputValue(now))

  const dayStats = useMemo(() => {
    const r = todayRange(now)
    return computeStats(sales, products, r.start, r.end)
  }, [sales, products, now])

  const monthStats = useMemo(() => {
    const r = monthRange(now)
    return computeStats(sales, products, r.start, r.end)
  }, [sales, products, now])

  const yearStats = useMemo(() => {
    const r = yearRange(now)
    return computeStats(sales, products, r.start, r.end)
  }, [sales, products, now])

  const selectedRange = useMemo(() => {
    if (preset === 'today') return todayRange(now)
    if (preset === 'month') return monthRange(now)
    if (preset === 'year') return yearRange(now)
    return customRange(from, to)
  }, [preset, from, to, now])

  const customStats = useMemo(() => {
    if (!selectedRange) {
      return {
        revenue: 0,
        cost: 0,
        profit: 0,
        orders: 0,
        itemsSold: 0,
        margin: 0,
      }
    }
    return computeStats(
      sales,
      products,
      selectedRange.start,
      selectedRange.end,
    )
  }, [sales, products, selectedRange])

  const rows = useMemo(() => {
    if (!selectedRange) return []
    return dailyBreakdown(
      sales,
      products,
      selectedRange.start,
      selectedRange.end,
    )
  }, [sales, products, selectedRange])

  const periodLabel =
    preset === 'today'
      ? '今日明细'
      : preset === 'month'
        ? '本月按日明细'
        : preset === 'year'
          ? '本年按日明细'
          : `自定义周期 ${from} ~ ${to}`

  return (
    <div className="page reports-page">
      <section className="report-summary-grid">
        <StatCards title="今日" stats={dayStats} />
        <StatCards title="本月" stats={monthStats} />
        <StatCards title="本年" stats={yearStats} />
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>统计周期</h2>
        </header>
        <div className="pay-tabs report-presets">
          {(
            [
              ['today', '今日'],
              ['month', '本月'],
              ['year', '本年'],
              ['custom', '自定义'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pay-tab${preset === id ? ' active' : ''}`}
              onClick={() => setPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="report-range">
            <label>
              开始日期
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              结束日期
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        )}

        {!selectedRange && (
          <p className="toast warn">请选择有效的起止日期</p>
        )}

        <div className="report-metrics large">
          <article>
            <span>周期销售额</span>
            <strong>{formatMoney(customStats.revenue)}</strong>
          </article>
          <article>
            <span>周期利润</span>
            <strong className={customStats.profit >= 0 ? 'up' : 'down'}>
              {formatMoney(customStats.profit)}
            </strong>
          </article>
          <article>
            <span>周期成本</span>
            <strong>{formatMoney(customStats.cost)}</strong>
          </article>
          <article>
            <span>订单 / 毛利率</span>
            <strong>
              {customStats.orders} 笔 · {customStats.margin}%
            </strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>{periodLabel}</h2>
        </header>
        <div className="table-wrap compact">
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>订单数</th>
                <th>销售额</th>
                <th>成本</th>
                <th>利润</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.orders}</td>
                  <td>{formatMoney(row.revenue)}</td>
                  <td>{formatMoney(row.cost)}</td>
                  <td className={row.profit >= 0 ? 'up' : 'down'}>
                    {formatMoney(row.profit)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    该周期暂无销售数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
          利润 = 销售额 − 进价成本。新开单会记录成交时进价；历史单据若无成本快照，则按当前商品进价估算。
        </p>
      </section>
    </div>
  )
}
