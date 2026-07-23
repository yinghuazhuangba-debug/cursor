import type { ReactNode } from 'react'

export type PageId =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'reports'

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: 'dashboard', label: '经营概览', icon: '◈' },
  { id: 'pos', label: '收银台', icon: '▣' },
  { id: 'products', label: '商品管理', icon: '▤' },
  { id: 'inventory', label: '库存管理', icon: '▦' },
  { id: 'sales', label: '销售记录', icon: '▥' },
  { id: 'reports', label: '经营报表', icon: '◉' },
]

interface LayoutProps {
  page: PageId
  onNavigate: (id: PageId) => void
  children: ReactNode
}

export function Layout({ page, onNavigate, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <span />
            <span />
          </div>
          <div>
            <div className="brand-name">鲜邻超市</div>
            <div className="brand-tag">销售管理系统</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <p>桌面版数据保存在本机</p>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <h1 className="page-title">
            {NAV.find((n) => n.id === page)?.label}
          </h1>
          <div className="topbar-meta">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
