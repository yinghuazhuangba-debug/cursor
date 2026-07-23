import { useState } from 'react'
import { Layout, type PageId } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Inventory } from './pages/Inventory'
import { POS } from './pages/POS'
import { Products } from './pages/Products'
import { Sales } from './pages/Sales'
import { Reports } from './pages/Reports'
import { useAppStore } from './store/useStore'
import './App.css'

function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const { resetData, hydrated } = useAppStore()

  if (!hydrated) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <strong>鲜邻超市</strong>
          <p>正在加载本地账本…</p>
        </div>
      </div>
    )
  }

  return (
    <Layout page={page} onNavigate={setPage}>
      {page === 'dashboard' && (
        <Dashboard
          onGoPos={() => setPage('pos')}
          onGoInventory={() => setPage('inventory')}
        />
      )}
      {page === 'pos' && <POS />}
      {page === 'products' && <Products />}
      {page === 'inventory' && <Inventory />}
      {page === 'sales' && <Sales />}
      {page === 'reports' && <Reports />}

      {page === 'dashboard' && (
        <div className="danger-zone">
          <button
            type="button"
            className="link danger"
            onClick={() => {
              if (
                confirm(
                  '将清空所有销售与库存流水，并恢复示例商品数据。确定？',
                )
              ) {
                resetData()
              }
            }}
          >
            重置示例数据
          </button>
        </div>
      )}
    </Layout>
  )
}

export default App
