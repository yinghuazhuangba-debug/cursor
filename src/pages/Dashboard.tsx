import { useState } from 'react'
import { useAppStore, useTodayStats, formatMoney } from '../store/useStore'

interface DashboardProps {
  onGoPos: () => void
  onGoInventory: () => void
}

export function Dashboard({ onGoPos, onGoInventory }: DashboardProps) {
  const {
    products,
    sales,
    lowStockProducts,
    isDesktop,
    dbPath,
    dbDefaultPath,
    dbIsCustom,
    revealDatabase,
    chooseSaveDatabasePath,
    chooseOpenDatabasePath,
    resetDatabasePath,
  } = useAppStore()
  const { revenue, count, itemsSold, todaySales } = useTodayStats(sales)
  const [dbBusy, setDbBusy] = useState(false)
  const [dbMessage, setDbMessage] = useState<string | null>(null)

  const totalStockValue = products.reduce(
    (sum, p) => sum + p.cost * p.stock,
    0,
  )

  const paymentBreakdown = todaySales.reduce(
    (acc, s) => {
      acc[s.paymentMethod] = (acc[s.paymentMethod] ?? 0) + s.total
      return acc
    },
    {} as Record<string, number>,
  )

  const payLabels: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    card: '银行卡',
  }

  async function runDbAction(
    action: () => Promise<unknown>,
    okText: string,
  ) {
    setDbBusy(true)
    setDbMessage(null)
    try {
      const result = await action()
      if (result) setDbMessage(okText)
    } catch (err) {
      setDbMessage(err instanceof Error ? err.message : '操作失败')
    } finally {
      setDbBusy(false)
    }
  }

  return (
    <div className="page dashboard">
      <section className="hero-strip">
        <div>
          <p className="eyebrow">今日经营</p>
          <p className="hero-amount">{formatMoney(revenue)}</p>
          <p className="muted">营业额 · {count} 笔订单 · 售出 {itemsSold} 件</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn primary" onClick={onGoPos}>
            打开收银台
          </button>
          <button type="button" className="btn ghost" onClick={onGoInventory}>
            查看库存
          </button>
        </div>
      </section>

      {isDesktop && dbPath && (
        <section className="db-banner">
          <div>
            <strong>本地数据库 {dbIsCustom ? '（自定义）' : '（默认）'}</strong>
            <p className="mono muted">{dbPath}</p>
            {dbIsCustom && (
              <p className="muted db-default-hint">默认位置：{dbDefaultPath}</p>
            )}
            {dbMessage && <p className="db-feedback">{dbMessage}</p>}
          </div>
          <div className="db-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={dbBusy}
              onClick={() => void revealDatabase()}
            >
              打开文件夹
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={dbBusy}
              onClick={() =>
                void runDbAction(
                  chooseSaveDatabasePath,
                  '已切换到新位置（已复制当前数据）',
                )
              }
            >
              另存到…
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={dbBusy}
              onClick={() =>
                void runDbAction(
                  chooseOpenDatabasePath,
                  '已切换到所选数据库',
                )
              }
            >
              打开已有…
            </button>
            {dbIsCustom && (
              <button
                type="button"
                className="btn ghost"
                disabled={dbBusy}
                onClick={() =>
                  void runDbAction(resetDatabasePath, '已恢复默认位置')
                }
              >
                恢复默认
              </button>
            )}
          </div>
        </section>
      )}

      <section className="stat-grid">
        <article className="stat">
          <span className="stat-label">在售商品</span>
          <strong>{products.length}</strong>
          <span className="stat-hint">种 SKU</span>
        </article>
        <article className="stat">
          <span className="stat-label">库存成本</span>
          <strong>{formatMoney(totalStockValue)}</strong>
          <span className="stat-hint">按进价估算</span>
        </article>
        <article className="stat warn">
          <span className="stat-label">低库存预警</span>
          <strong>{lowStockProducts.length}</strong>
          <span className="stat-hint">需补货商品</span>
        </article>
        <article className="stat">
          <span className="stat-label">历史订单</span>
          <strong>{sales.length}</strong>
          <span className="stat-hint">累计笔数</span>
        </article>
      </section>

      <div className="split-panels">
        <section className="panel">
          <header className="panel-head">
            <h2>支付方式分布（今日）</h2>
          </header>
          {Object.keys(paymentBreakdown).length === 0 ? (
            <p className="empty">今日暂无成交，去收银台开单吧。</p>
          ) : (
            <ul className="pay-list">
              {Object.entries(paymentBreakdown).map(([method, amount]) => (
                <li key={method}>
                  <span>{payLabels[method] ?? method}</span>
                  <strong>{formatMoney(amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>低库存商品</h2>
          </header>
          {lowStockProducts.length === 0 ? (
            <p className="empty">库存充足，暂无预警。</p>
          ) : (
            <ul className="alert-list">
              {lowStockProducts.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted">
                      最低 {p.minStock} {p.unit}
                    </span>
                  </div>
                  <span className="badge danger">
                    剩 {p.stock} {p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
