import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Category, Product } from '../types'
import { CATEGORIES } from '../types'
import { formatMoney, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

const emptyForm = {
  barcode: '',
  name: '',
  category: '其他' as Category,
  price: '',
  cost: '',
  stock: '',
  unit: '件',
  minStock: '5',
}

export function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useAppStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | '全部'>('全部')
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = category === '全部' || p.category === category
      const q = search.trim()
      const matchQ =
        !q ||
        p.name.includes(q) ||
        p.barcode.includes(q) ||
        p.category.includes(q)
      return matchCat && matchQ
    })
  }, [products, search, category])

  useEffect(() => {
    if (!showForm) return
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [showForm])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      unit: p.unit,
      minStock: String(p.minStock),
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload = {
      barcode: normalizeScanCode(form.barcode) || form.barcode.trim(),
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      unit: form.unit.trim() || '件',
      minStock: Number(form.minStock) || 0,
    }
    if (!payload.barcode || !payload.name) return

    if (editing) {
      updateProduct(editing.id, payload)
    } else {
      addProduct(payload)
    }
    closeForm()
    setForm(emptyForm)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          className="search"
          placeholder="搜索名称 / 条码 / 分类"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '全部')}
        >
          <option value="全部">全部分类</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" onClick={openCreate}>
          新增商品
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>条码</th>
              <th>名称</th>
              <th>分类</th>
              <th>售价</th>
              <th>进价</th>
              <th>库存</th>
              <th>单位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={p.stock <= p.minStock ? 'row-warn' : ''}>
                <td className="mono">{p.barcode}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{formatMoney(p.price)}</td>
                <td>{formatMoney(p.cost)}</td>
                <td>
                  {p.stock}
                  {p.stock <= p.minStock && (
                    <span className="badge danger inline">低</span>
                  )}
                </td>
                <td>{p.unit}</td>
                <td className="actions">
                  <button
                    type="button"
                    className="link"
                    onClick={() => openEdit(p)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => {
                      if (confirm(`确定删除「${p.name}」？`)) {
                        deleteProduct(p.id)
                      }
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">
                  没有匹配的商品
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeForm()
            }}
          >
            <form
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-form-title"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
            >
              <h2 id="product-form-title">
                {editing ? '编辑商品' : '新增商品'}
              </h2>
              <div className="form-grid">
                <label>
                  条码 / 二维码内容
                  <input
                    ref={firstInputRef}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="可用扫码枪直接扫入"
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, barcode: e.target.value }))
                    }
                  />
                </label>
                <label>
                  名称
                  <input
                    type="text"
                    autoComplete="off"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  分类
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as Category,
                      }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  单位
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                  />
                </label>
                <label>
                  售价
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                </label>
                <label>
                  进价
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cost: e.target.value }))
                    }
                  />
                </label>
                <label>
                  库存
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stock: e.target.value }))
                    }
                  />
                </label>
                <label>
                  最低库存
                  <input
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minStock: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeForm}
                >
                  取消
                </button>
                <button type="submit" className="btn primary">
                  保存
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
