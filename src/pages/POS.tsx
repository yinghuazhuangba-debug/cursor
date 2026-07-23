import { useEffect, useMemo, useRef, useState } from 'react'
import type { CartItem, Sale } from '../types'
import { registeredCasePrice, PAYMENT_LABELS } from '../types'
import { formatMoney, useAppStore } from '../store/useStore'
import { normalizeScanCode } from '../utils/scanCode'

export function POS() {
  const { products, findByScan, checkout } = useAppStore()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] =
    useState<Sale['paymentMethod']>('wechat')
  const [paidInput, setPaidInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [priceFlash, setPriceFlash] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const total = useMemo(
    () => +cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2),
    [cart],
  )

  const paid = paidInput === '' ? total : Number(paidInput) || 0
  const change = +(Math.max(0, paid - total)).toFixed(2)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function flashPrice(text: string) {
    setPriceFlash(text)
    window.setTimeout(() => setPriceFlash(null), 2500)
  }

  function addCartItem(item: CartItem, stockNeed: number) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return
    if (product.stock < stockNeed) {
      setMessage(
        `${product.name} 库存不足（剩 ${product.stock}${product.unit}）`,
      )
      return
    }

    setCart((prev) => {
      const existing = prev.find(
        (i) =>
          i.productId === item.productId &&
          i.pack === item.pack &&
          i.price === item.price &&
          i.name === item.name,
      )
      if (existing) {
        const nextQty = existing.quantity + item.quantity
        const nextStock =
          (existing.stockQty ?? existing.quantity) + stockNeed
        if (nextStock > product.stock) {
          setMessage(
            `${product.name} 库存不足（剩 ${product.stock}${product.unit}）`,
          )
          return prev
        }
        return prev.map((i) =>
          i === existing
            ? { ...i, quantity: nextQty, stockQty: nextStock }
            : i,
        )
      }
      return [...prev, { ...item, stockQty: stockNeed }]
    })
    setMessage(null)
    setQuery('')
    inputRef.current?.focus()
  }

  /** 按瓶/最小单位加入购物车 */
  function addUnit(productId: string, qty = 1) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    addCartItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        pack: 'unit',
      },
      qty,
    )
    flashPrice(
      `${product.name} 单价 ${formatMoney(product.price)} / ${product.unit}`,
    )
  }

  /** 按整箱加入购物车：必须使用建档箱价 */
  function addCase(productId: string, cases = 1) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (!product.caseBarcode) {
      setMessage(`${product.name} 未设置箱码，无法按箱出售`)
      return
    }
    const price = registeredCasePrice(product)
    if (price == null) {
      setMessage(
        `${product.name} 未录入整箱售价，请先在商品管理填写「整箱售价」`,
      )
      return
    }
    const perCase = Math.max(1, product.unitsPerCase || 1)
    const stockNeed = cases * perCase
    addCartItem(
      {
        productId: product.id,
        name: `${product.name}（整箱${perCase}${product.unit}）`,
        price,
        quantity: cases,
        pack: 'case',
      },
      stockNeed,
    )
    flashPrice(
      `按箱出售 · ${product.name} 箱价 ${formatMoney(price)}（含${perCase}${product.unit}）`,
    )
  }

  function handleScan() {
    const raw = query.trim()
    const code = normalizeScanCode(raw)
    if (!code && !raw) return

    const hit = findByScan(raw)
    if (hit) {
      if (hit.pack === 'case') {
        // 输入/扫描箱码 → 强制按箱、按建档箱价出售
        addCase(hit.product.id, 1)
      } else {
        addUnit(hit.product.id, 1)
      }
      return
    }

    const byName = products.filter(
      (p) => p.name.includes(raw) || p.name.includes(code),
    )
    if (byName.length === 1) {
      addUnit(byName[0].id, 1)
      return
    }
    if (byName.length === 0) {
      setMessage(`未找到商品：${code || raw}`)
    }
  }

  function setQty(productId: string, pack: CartItem['pack'], quantity: number, name: string, price: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (quantity <= 0) {
      setCart((prev) =>
        prev.filter(
          (i) =>
            !(
              i.productId === productId &&
              i.pack === pack &&
              i.name === name &&
              i.price === price
            ),
        ),
      )
      return
    }

    const per =
      pack === 'case' ? Math.max(1, product.unitsPerCase || 1) : 1
    const stockNeed = quantity * per
    if (stockNeed > product.stock) {
      setMessage(`库存不足，最多约 ${Math.floor(product.stock / per)}`)
      return
    }

    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId &&
        i.pack === pack &&
        i.name === name &&
        i.price === price
          ? { ...i, quantity, stockQty: stockNeed }
          : i,
      ),
    )
  }

  function handleCheckout() {
    if (!cart.length) {
      setMessage('购物车为空')
      return
    }
    if (paid < total) {
      setMessage('实收金额不足')
      return
    }
    for (const item of cart) {
      const p = products.find((x) => x.id === item.productId)
      const need = item.stockQty ?? item.quantity
      if (!p || p.stock < need) {
        setMessage(`${item.name} 库存不足`)
        return
      }
    }
    const sale = checkout(cart, paymentMethod, paid)
    if (sale) {
      setLastSale(sale)
      setCart([])
      setPaidInput('')
      setMessage(null)
      setPriceFlash(null)
      inputRef.current?.focus()
    }
  }

  const suggestions = useMemo(() => {
    const q = query.trim()
    if (!q || findByScan(q)) return []
    return products
      .filter(
        (p) =>
          p.name.includes(q) ||
          p.barcode.includes(q) ||
          (p.caseBarcode && p.caseBarcode.includes(q)) ||
          p.category.includes(q),
      )
      .slice(0, 8)
  }, [query, products, findByScan])

  return (
    <div className="page pos-page">
      <div className="pos-layout">
        <section className="pos-left">
          <div className="scan-bar">
            <input
              ref={inputRef}
              className="scan-input"
              placeholder="扫瓶码按瓶卖（瓶价）；输入/扫箱码按箱卖（建档箱价）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleScan()
                }
              }}
            />
            <button type="button" className="btn primary" onClick={handleScan}>
              添加
            </button>
          </div>

          {priceFlash && <div className="price-flash">{priceFlash}</div>}

          {suggestions.length > 0 && (
            <ul className="suggest-list">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addUnit(p.id)}>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        瓶码 {p.barcode}
                        {p.caseBarcode ? ` · 箱码 ${p.caseBarcode}` : ''} · 库存{' '}
                        {p.stock}
                        {p.unit}
                      </small>
                    </span>
                    <em>{formatMoney(p.price)}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {message && <div className="toast warn">{message}</div>}

          <div className="cart-table-wrap">
            <table className="data-table cart-table">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>单价</th>
                  <th>数量</th>
                  <th>小计</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      扫瓶码：按瓶价加入；扫/输入箱码：按建档箱价整箱加入
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={`${item.productId}-${item.pack}-${item.name}-${item.price}`}>
                      <td>
                        {item.name}
                        {item.pack === 'case' && (
                          <span className="badge soft inline">箱</span>
                        )}
                      </td>
                      <td>{formatMoney(item.price)}</td>
                      <td>
                        <div className="qty-ctrl">
                          <button
                            type="button"
                            onClick={() =>
                              setQty(
                                item.productId,
                                item.pack,
                                item.quantity - 1,
                                item.name,
                                item.price,
                              )
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              setQty(
                                item.productId,
                                item.pack,
                                Number(e.target.value) || 0,
                                item.name,
                                item.price,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQty(
                                item.productId,
                                item.pack,
                                item.quantity + 1,
                                item.name,
                                item.price,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>{formatMoney(item.price * item.quantity)}</td>
                      <td>
                        <button
                          type="button"
                          className="link danger"
                          onClick={() =>
                            setQty(
                              item.productId,
                              item.pack,
                              0,
                              item.name,
                              item.price,
                            )
                          }
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="quick-grid">
            <p className="section-label">快捷选品（点按瓶加入）</p>
            <div className="chip-grid">
              {products.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="product-chip"
                  disabled={p.stock <= 0}
                  onClick={() => addUnit(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>
                    {formatMoney(p.price)}/{p.unit} · 余{p.stock}
                  </span>
                  {p.unitsPerCase > 1 && (
                    <span className="chip-case">
                      {registeredCasePrice(p) != null
                        ? `箱价 ${formatMoney(registeredCasePrice(p)!)}`
                        : '未设箱价'}{' '}
                      · {p.unitsPerCase}
                      {p.unit}/箱
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="pos-right">
          <div className="checkout-panel">
            <div className="total-block">
              <span>应付合计</span>
              <strong>{formatMoney(total)}</strong>
            </div>

            <label className="field">
              <span>支付方式</span>
              <div className="pay-tabs">
                {(
                  Object.keys(PAYMENT_LABELS) as Sale['paymentMethod'][]
                ).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pay-tab${paymentMethod === m ? ' active' : ''}`}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </label>

            <label className="field">
              <span>实收金额</span>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder={String(total)}
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
              />
            </label>

            <div className="change-row">
              <span>找零</span>
              <strong>{formatMoney(change)}</strong>
            </div>

            <button
              type="button"
              className="btn primary block xl"
              disabled={!cart.length}
              onClick={handleCheckout}
            >
              确认收款
            </button>

            <button
              type="button"
              className="btn ghost block"
              disabled={!cart.length}
              onClick={() => setCart([])}
            >
              清空购物车
            </button>
          </div>

          {lastSale && (
            <div className="receipt">
              <h3>最近一笔</h3>
              <p>
                {PAYMENT_LABELS[lastSale.paymentMethod]} ·{' '}
                {formatMoney(lastSale.total)}
              </p>
              <ul>
                {lastSale.items.map((i) => (
                  <li key={i.productId + i.name}>
                    {i.name} ×{i.quantity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
