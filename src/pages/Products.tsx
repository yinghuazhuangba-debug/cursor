import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Category, Product } from '../types'
import { formatMoney, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

const emptyForm = {
  barcode: '',
  caseBarcode: '',
  unitsPerCase: '1',
  name: '',
  category: '其他' as Category,
  price: '',
  cost: '',
  casePrice: '',
  stock: '',
  unit: '瓶',
  minStock: '5',
}

export function Products() {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    renameCategory,
    deleteCategory,
  } = useAppStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | '全部'>('全部')
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newCat, setNewCat] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  const firstInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = category === '全部' || p.category === category
      const q = search.trim()
      const matchQ =
        !q ||
        p.name.includes(q) ||
        p.barcode.includes(q) ||
        (p.caseBarcode && p.caseBarcode.includes(q)) ||
        p.category.includes(q)
      return matchCat && matchQ
    })
  }, [products, search, category])

  useEffect(() => {
    if (!showForm) return
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [showForm])

  useEffect(() => {
    if (!showCats) return
    const drafts: Record<string, string> = {}
    for (const c of categories) drafts[c] = c
    setRenameDrafts(drafts)
  }, [showCats, categories])

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyForm,
      category: categories.includes('其他')
        ? '其他'
        : categories[0] || '其他',
    })
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      barcode: p.barcode,
      caseBarcode: p.caseBarcode || '',
      unitsPerCase: String(p.unitsPerCase || 1),
      name: p.name,
      category: p.category,
      price: String(p.price),
      cost: String(p.cost),
      casePrice: String(p.casePrice || ''),
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
      caseBarcode:
        normalizeScanCode(form.caseBarcode) || form.caseBarcode.trim(),
      unitsPerCase: Math.max(1, Number(form.unitsPerCase) || 1),
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      casePrice: Number(form.casePrice) || 0,
      stock: Number(form.stock) || 0,
      unit: form.unit.trim() || '瓶',
      minStock: Number(form.minStock) || 0,
    }
    if (!payload.barcode || !payload.name) return
    if (payload.caseBarcode && !payload.casePrice) {
      alert('已填写箱码时，请同时填写「整箱售价」，扫箱码将按该箱价出售')
      return
    }
    if (
      payload.caseBarcode &&
      payload.caseBarcode === payload.barcode
    ) {
      alert('箱码不能与瓶码相同，否则无法区分按瓶/按箱出售')
      return
    }

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
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setShowCats(true)}
        >
          维护分类
        </button>
        <button type="button" className="btn primary" onClick={openCreate}>
          新增商品
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>瓶/零售码</th>
              <th>箱码</th>
              <th>名称</th>
              <th>箱规</th>
              <th>瓶价</th>
              <th>库存</th>
              <th>单位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={p.stock <= p.minStock ? 'row-warn' : ''}>
                <td className="mono">{p.barcode}</td>
                <td className="mono">{p.caseBarcode || '—'}</td>
                <td>
                  {p.name}
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    {p.category}
                  </div>
                </td>
                <td>
                  {p.unitsPerCase > 1
                    ? `${p.unitsPerCase}${p.unit}/箱`
                    : '—'}
                </td>
                <td>{formatMoney(p.price)}</td>
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
                  瓶码 / 零售码
                  <input
                    ref={firstInputRef}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="扫瓶身码"
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, barcode: e.target.value }))
                    }
                  />
                </label>
                <label>
                  箱码（可选）
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="扫外箱码"
                    value={form.caseBarcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, caseBarcode: e.target.value }))
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
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  最小单位
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="瓶/袋/罐"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                  />
                </label>
                <label>
                  箱规（一箱几件）
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.unitsPerCase}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unitsPerCase: e.target.value }))
                    }
                  />
                </label>
                <label>
                  瓶/零售单价
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
                  整箱售价（有箱码必填）
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="扫箱码时按此价整箱出售"
                    value={form.casePrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, casePrice: e.target.value }))
                    }
                  />
                </label>
                <label>
                  进价（按最小单位）
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
                  库存（按最小单位）
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
              <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                例：一箱矿泉水 24 瓶。瓶码用于零售扫码；箱码用于整箱入库。库存始终按「瓶」计数。
              </p>
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

      {showCats &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowCats(false)
            }}
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2>维护商品分类</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                可新增、重命名、删除分类。「其他」为系统保留，不可删除。
              </p>

              <div className="cat-add-row">
                <input
                  type="text"
                  placeholder="新分类名称，如：烟酒"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (addCategory(newCat)) {
                        setNewCat('')
                      } else {
                        alert('分类为空或已存在')
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    if (addCategory(newCat)) setNewCat('')
                    else alert('分类为空或已存在')
                  }}
                >
                  添加
                </button>
              </div>

              <ul className="cat-list">
                {categories.map((c) => {
                  const count = products.filter((p) => p.category === c).length
                  return (
                    <li key={c}>
                      <input
                        type="text"
                        value={renameDrafts[c] ?? c}
                        disabled={c === '其他'}
                        onChange={(e) =>
                          setRenameDrafts((d) => ({
                            ...d,
                            [c]: e.target.value,
                          }))
                        }
                      />
                      <span className="muted">{count} 件商品</span>
                      <div className="actions">
                        {c !== '其他' && (
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              const next = (renameDrafts[c] ?? c).trim()
                              if (next === c) return
                              if (!renameCategory(c, next)) {
                                alert('重命名失败：名称无效或已存在')
                                return
                              }
                              if (category === c) setCategory(next)
                            }}
                          >
                            保存改名
                          </button>
                        )}
                        {c !== '其他' && (
                          <button
                            type="button"
                            className="link danger"
                            onClick={() => {
                              if (
                                !confirm(
                                  `删除分类「${c}」？该分类下商品将归入「其他」。`,
                                )
                              ) {
                                return
                              }
                              deleteCategory(c)
                              if (category === c) setCategory('全部')
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setShowCats(false)}
                >
                  完成
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
