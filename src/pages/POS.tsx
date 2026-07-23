import { useEffect, useMemo, useRef, useState } from 'react'
import type { CartItem, Sale } from '../types'
import { PAYMENT_LABELS } from '../types'
import { formatMoney, useAppStore } from '../store/useStore'

export function POS() {
  const { products, findByBarcode, checkout } = useAppStore()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] =
    useState<Sale['paymentMethod']>('wechat')
  const [paidInput, setPaidInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
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

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (product.stock <= 0) {
      setMessage(`${product.name} 库存不足`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId)
      if (existing) {
        if (existing.quantity >= product.stock) {
          setMessage(`${product.name} 库存仅剩 ${product.stock}`)
          return prev
        }
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ]
    })
    setMessage(null)
    setQuery('')
    inputRef.current?.focus()
  }

  function handleScan() {
    const q = query.trim()
    if (!q) return
    const byBarcode = findByBarcode(q)
    if (byBarcode) {
      addProduct(byBarcode.id)
      return
    }
    const byName = products.filter((p) => p.name.includes(q))
    if (byName.length === 1) {
      addProduct(byName[0].id)
      return
    }
    if (byName.length === 0) {
      setMessage('未找到商品，请检查条码或名称')
    }
  }

  function setQty(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId))
      return
    }
    if (quantity > product.stock) {
      setMessage(`库存不足，最多 ${product.stock}`)
      return
    }
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity } : i,
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
      if (!p || p.stock < item.quantity) {
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
      inputRef.current?.focus()
    }
  }

  const suggestions = useMemo(() => {
    const q = query.trim()
    if (!q || findByBarcode(q)) return []
    return products
      .filter(
        (p) =>
          p.name.includes(q) ||
          p.barcode.includes(q) ||
          p.category.includes(q),
      )
      .slice(0, 8)
  }, [query, products, findByBarcode])

  return (
    <div className="page pos-page">
      <div className="pos-layout">
        <section className="pos-left">
          <div className="scan-bar">
            <input
              ref={inputRef}
              className="scan-input"
              placeholder="扫码 / 输入条码或商品名，回车添加"
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

          {suggestions.length > 0 && (
            <ul className="suggest-list">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addProduct(p.id)}>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.barcode} · 库存 {p.stock}
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
                      扫码或搜索商品加入购物车
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{formatMoney(item.price)}</td>
                      <td>
                        <div className="qty-ctrl">
                          <button
                            type="button"
                            onClick={() =>
                              setQty(item.productId, item.quantity - 1)
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
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQty(item.productId, item.quantity + 1)
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
                          onClick={() => setQty(item.productId, 0)}
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
            <p className="section-label">快捷选品</p>
            <div className="chip-grid">
              {products.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="product-chip"
                  disabled={p.stock <= 0}
                  onClick={() => addProduct(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>
                    {formatMoney(p.price)} · 余{p.stock}
                  </span>
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
