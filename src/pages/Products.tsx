import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Category, Product } from '../types'
import { formatMoney, useAppStore } from '../store/useStore'
import { fuzzyMatchProducts } from '../utils/fuzzy'
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
    adjustStock,
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
  /** 编辑/匹配已有商品时：本次补货数量（不直接改原库存） */
  const [restockQty, setRestockQty] = useState('0')
  const [newCat, setNewCat] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  /** 单价是否被手动改过；未改则保存时用历史单价 */
  const [priceDirty, setPriceDirty] = useState(false)
  const [casePriceDirty, setCasePriceDirty] = useState(false)
  const [costDirty, setCostDirty] = useState(false)
  const [historyHint, setHistoryHint] = useState<string | null>(null)
  /** 条码带出的历史商品快照（用于未改价时回填） */
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false)
  /** 仅用户手动改名称时才弹出模糊列表，避免带出历史后挡住保存按钮 */
  const [nameTyping, setNameTyping] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const nameSuggestions = useMemo(() => {
    if (!nameTyping) return []
    return fuzzyMatchProducts(products, form.name, 8)
  }, [products, form.name, nameTyping])

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

  function productToForm(p: Product) {
    return {
      barcode: p.barcode,
      caseBarcode: p.caseBarcode || '',
      unitsPerCase: String(p.unitsPerCase || 1),
      name: p.name,
      category: p.category,
      price: String(p.price),
      cost: String(p.cost),
      casePrice: p.casePrice > 0 ? String(p.casePrice) : '',
      stock: String(p.stock),
      unit: p.unit,
      minStock: String(p.minStock),
    }
  }

  function openCreate() {
    setEditing(null)
    setHistoryProduct(null)
    setHistoryHint(null)
    setPriceDirty(false)
    setCasePriceDirty(false)
    setCostDirty(false)
    setNameTyping(false)
    setNameSuggestOpen(false)
    setRestockQty('0')
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
    setHistoryProduct(p)
    setHistoryHint(
      `已带出历史单价：瓶价 ${formatMoney(p.price)}${
        p.casePrice > 0 ? `，箱价 ${formatMoney(p.casePrice)}` : ''
      }。可修改；不改则按历史价保存。`,
    )
    setPriceDirty(false)
    setCasePriceDirty(false)
    setCostDirty(false)
    setNameTyping(false)
    setNameSuggestOpen(false)
    setRestockQty('0')
    setForm(productToForm(p))
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setHistoryProduct(null)
    setHistoryHint(null)
    setPriceDirty(false)
    setCasePriceDirty(false)
    setCostDirty(false)
    setNameTyping(false)
    setNameSuggestOpen(false)
    setRestockQty('0')
  }

  function fillFromHistory(hit: Product, source: '码' | '名称') {
    setEditing(hit)
    setHistoryProduct(hit)
    setPriceDirty(false)
    setCasePriceDirty(false)
    setCostDirty(false)
    setNameTyping(false)
    setNameSuggestOpen(false)
    setRestockQty('0')
    setForm(productToForm(hit))
    setHistoryHint(
      `已按${source}匹配历史商品「${hit.name}」，已带出瓶码 ${hit.barcode}${
        hit.caseBarcode ? `、箱码 ${hit.caseBarcode}` : ''
      }，历史瓶价 ${formatMoney(hit.price)}${
        hit.casePrice > 0 ? ` / 箱价 ${formatMoney(hit.casePrice)}` : ''
      }。可修改；不改则按历史价保存。补货请填「本次补货数量」。`,
    )
  }

  /** 扫/输入瓶码或箱码后，按历史商品自动带出资料与单价 */
  function applyHistoryByCode(raw: string) {
    const code = normalizeScanCode(raw) || raw.trim()
    if (!code) return

    const hit = products.find((p) => {
      const unit = normalizeScanCode(p.barcode) || p.barcode.trim()
      const caseCode = p.caseBarcode
        ? normalizeScanCode(p.caseBarcode) || p.caseBarcode.trim()
        : ''
      return (
        unit === code ||
        caseCode === code ||
        p.barcode === code ||
        p.caseBarcode === code
      )
    })

    if (!hit) {
      if (historyProduct && !editing) {
        setHistoryProduct(null)
        setHistoryHint(null)
      }
      return
    }

    if (editing?.id === hit.id && historyProduct?.id === hit.id) {
      return
    }

    fillFromHistory(hit, '码')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const hist = historyProduct || editing

    const price = !priceDirty && hist
      ? hist.price
      : Number(form.price) || 0
    const cost = !costDirty && hist
      ? hist.cost
      : Number(form.cost) || 0
    const casePrice = !casePriceDirty && hist
      ? hist.casePrice || 0
      : Number(form.casePrice) || 0

    const restock = Math.max(0, Math.floor(Number(restockQty) || 0))
    const liveStock = editing
      ? (products.find((p) => p.id === editing.id)?.stock ?? editing.stock)
      : 0

    const payload = {
      barcode: normalizeScanCode(form.barcode) || form.barcode.trim(),
      caseBarcode:
        normalizeScanCode(form.caseBarcode) || form.caseBarcode.trim(),
      unitsPerCase: Math.max(1, Number(form.unitsPerCase) || 1),
      name: form.name.trim(),
      category: form.category,
      price,
      cost,
      casePrice,
      stock: editing ? liveStock : Number(form.stock) || 0,
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
      updateProduct(editing.id, {
        barcode: payload.barcode,
        caseBarcode: payload.caseBarcode,
        unitsPerCase: payload.unitsPerCase,
        name: payload.name,
        category: payload.category,
        price: payload.price,
        cost: payload.cost,
        casePrice: payload.casePrice,
        unit: payload.unit,
        minStock: payload.minStock,
      })
      if (restock > 0) {
        adjustStock(
          editing.id,
          restock,
          'in',
          `商品编辑补货 +${restock}${payload.unit}`,
        )
      }
    } else {
      addProduct(payload)
    }
    closeForm()
    setForm(emptyForm)
  }

  const editingLiveStock = editing
    ? (products.find((p) => p.id === editing.id)?.stock ?? editing.stock)
    : 0
  const restockPreview = Math.max(0, Math.floor(Number(restockQty) || 0))

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
              <div className="modal-scroll">
              {historyHint && (
                <div className="toast warn" style={{ marginBottom: '0.85rem' }}>
                  {historyHint}
                </div>
              )}
              <div className="form-grid">
                <label>
                  瓶码 / 零售码
                  <input
                    ref={firstInputRef}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="扫码后回车，自动带出历史单价"
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, barcode: e.target.value }))
                    }
                    onBlur={() => applyHistoryByCode(form.barcode)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyHistoryByCode(form.barcode)
                      }
                    }}
                  />
                </label>
                <label>
                  箱码（可选）
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="扫箱码回车也可带出历史"
                    value={form.caseBarcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, caseBarcode: e.target.value }))
                    }
                    onBlur={() => {
                      if (form.caseBarcode.trim()) {
                        applyHistoryByCode(form.caseBarcode)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyHistoryByCode(form.caseBarcode)
                      }
                    }}
                  />
                </label>
                <label className="name-suggest-field">
                  名称
                  <input
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="输入名称模糊查询，选中后带出瓶码/箱码"
                    value={form.name}
                    onChange={(e) => {
                      setNameTyping(true)
                      setNameSuggestOpen(true)
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }}
                    onFocus={() => {
                      if (nameTyping) setNameSuggestOpen(true)
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setNameSuggestOpen(false), 150)
                    }}
                  />
                  {nameSuggestOpen && nameSuggestions.length > 0 && (
                    <ul className="name-suggest-list">
                      {nameSuggestions.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => fillFromHistory(p, '名称')}
                          >
                            <strong>{p.name}</strong>
                            <small>
                              瓶码 {p.barcode}
                              {p.caseBarcode ? ` · 箱码 ${p.caseBarcode}` : ''}
                              {' · '}
                              {formatMoney(p.price)}/{p.unit}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
                    onChange={(e) => {
                      setPriceDirty(true)
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }}
                  />
                  {!priceDirty && historyProduct && (
                    <small className="field-hint">
                      默认历史价 {formatMoney(historyProduct.price)}
                    </small>
                  )}
                </label>
                <label>
                  整箱售价（有箱码必填）
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="扫箱码时按此价整箱出售"
                    value={form.casePrice}
                    onChange={(e) => {
                      setCasePriceDirty(true)
                      setForm((f) => ({ ...f, casePrice: e.target.value }))
                    }}
                  />
                  {!casePriceDirty &&
                    historyProduct &&
                    historyProduct.casePrice > 0 && (
                      <small className="field-hint">
                        默认历史箱价 {formatMoney(historyProduct.casePrice)}
                      </small>
                    )}
                </label>
                <label>
                  进价（按最小单位）
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(e) => {
                      setCostDirty(true)
                      setForm((f) => ({ ...f, cost: e.target.value }))
                    }}
                  />
                  {!costDirty && historyProduct && (
                    <small className="field-hint">
                      默认历史进价 {formatMoney(historyProduct.cost)}
                    </small>
                  )}
                </label>
                {editing ? (
                  <>
                    <label>
                      原库存（按最小单位）
                      <input
                        type="text"
                        readOnly
                        className="readonly-field"
                        value={`${editingLiveStock} ${form.unit.trim() || '瓶'}`}
                      />
                    </label>
                    <label>
                      本次补货数量
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="不补货填 0"
                        value={restockQty}
                        onChange={(e) => setRestockQty(e.target.value)}
                      />
                      <small className="field-hint">
                        补货后库存{' '}
                        {editingLiveStock + restockPreview}
                        {form.unit.trim() || '瓶'}
                        {restockPreview > 0
                          ? `（${editingLiveStock} + ${restockPreview}）`
                          : ''}
                      </small>
                    </label>
                  </>
                ) : (
                  <label>
                    初始库存（按最小单位）
                    <input
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, stock: e.target.value }))
                      }
                    />
                  </label>
                )}
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
                维护规则：瓶码=零售最小单位；箱码=外箱码且不可与瓶码相同；箱规=一箱几件。
                可用名称模糊查询或扫码带出历史编码与单价。库存始终按最小单位（如瓶）计数。
              </p>
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
              <div className="modal-scroll">
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
              </div>

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
