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

  const productsByName = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    [products],
  )

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

  function resetToCreateForm() {
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
      `已按${source}匹配历史商品「${hit.name}」，已带出编码 ${hit.barcode}${
        hit.caseBarcode ? `、箱码 ${hit.caseBarcode}` : ''
      }，历史瓶价 ${formatMoney(hit.price)}${
        hit.casePrice > 0 ? ` / 箱价 ${formatMoney(hit.casePrice)}` : ''
      }。可修改；不改则按历史价保存。补货请填「本次补货数量」。`,
    )
  }

  /** 仅新建时：扫/输入编码或箱码后自动带出历史；编辑中可自由改编码，不再回填冲掉 */
  function applyHistoryByCode(raw: string) {
    if (editing) return

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
      if (historyProduct) {
        setHistoryProduct(null)
        setHistoryHint(null)
      }
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
      alert('箱码不能与编码相同，否则无法区分按瓶/按箱出售')
      return
    }

    const codeTaken = products.some((p) => {
      if (editing && p.id === editing.id) return false
      const unit = normalizeScanCode(p.barcode) || p.barcode.trim()
      const caseCode = p.caseBarcode
        ? normalizeScanCode(p.caseBarcode) || p.caseBarcode.trim()
        : ''
      return (
        unit === payload.barcode ||
        p.barcode === payload.barcode ||
        (payload.caseBarcode &&
          (caseCode === payload.caseBarcode ||
            p.caseBarcode === payload.caseBarcode)) ||
        (caseCode && caseCode === payload.barcode) ||
        (payload.caseBarcode && unit === payload.caseBarcode)
      )
    })
    if (codeTaken) {
      alert('编码或箱码与其他商品重复，请换一个')
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
          placeholder="搜索名称 / 编码 / 分类"
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
              <th>名称</th>
              <th>编码</th>
              <th>箱码</th>
              <th>箱规</th>
              <th>瓶价</th>
              <th>库存</th>
              <th className="col-unit">单位</th>
              <th className="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={p.stock <= p.minStock ? 'row-warn' : ''}>
                <td className="cell-name">
                  {p.name}
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    {p.category}
                  </div>
                </td>
                <td className="mono">{p.barcode}</td>
                <td className="mono">{p.caseBarcode || '—'}</td>
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
                <td className="col-unit">{p.unit}</td>
                <td className="col-actions">
                  <div className="actions">
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
                  </div>
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
                <label className="form-span">
                  从已有商品选择
                  <select
                    value={editing?.id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value
                      if (!id) {
                        resetToCreateForm()
                        return
                      }
                      const hit = products.find((p) => p.id === id)
                      if (hit) fillFromHistory(hit, '名称')
                    }}
                  >
                    <option value="">新建商品（不选已有）</option>
                    {productsByName.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · 编码 {p.barcode}
                        {p.stock >= 0 ? ` · 库存 ${p.stock}${p.unit}` : ''}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">
                    补货或改价：直接下拉选已有商品；新品：选「新建」后填名称与编码
                  </small>
                </label>
                <label className="name-suggest-field form-span">
                  商品名称
                  <input
                    ref={firstInputRef}
                    type="text"
                    autoComplete="off"
                    required
                    list="product-name-options"
                    placeholder="输入新名称，或从上方下拉选择已有商品"
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
                  <datalist id="product-name-options">
                    {productsByName.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
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
                              编码 {p.barcode}
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
                  编码（自定，每种商品唯一）
                  <input
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="如 NS550、水01，方便记忆；编辑时可直接修改"
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, barcode: e.target.value }))
                    }
                    onBlur={() => {
                      if (!editing) applyHistoryByCode(form.barcode)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!editing) applyHistoryByCode(form.barcode)
                      }
                    }}
                  />
                  {editing && (
                    <small className="field-hint">编辑时可修改编码，保存后生效</small>
                  )}
                </label>
                <label>
                  箱码（可选）
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder={
                      editing
                        ? '可修改箱码'
                        : '扫箱码回车也可带出历史'
                    }
                    value={form.caseBarcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, caseBarcode: e.target.value }))
                    }
                    onBlur={() => {
                      if (!editing && form.caseBarcode.trim()) {
                        applyHistoryByCode(form.caseBarcode)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!editing && form.caseBarcode.trim()) {
                          applyHistoryByCode(form.caseBarcode)
                        }
                      }
                    }}
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
                建议：名称与编码尽量固定；编码可自定且每种商品唯一，编辑时也可修改。
                补货请用上方下拉选已有商品，只填本次补货数量。有箱码须填整箱售价。库存按最小单位计数。
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
