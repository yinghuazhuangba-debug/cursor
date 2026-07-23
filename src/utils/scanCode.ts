/**
 * 扫码枪通常以键盘方式输入内容并以 Enter 结束。
 * 外包装二维码可能是纯条码，也可能是 URL / JSON。
 */
export function normalizeScanCode(raw: string): string {
  const text = raw.trim()
  if (!text) return ''

  // 纯数字/字母条码（常见 EAN/UPC/自定义码）
  if (/^[0-9A-Za-z\-_]{4,64}$/.test(text)) return text

  // URL：取 query 中的常见字段，或路径末段
  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text)
      const keys = [
        'barcode',
        'code',
        'sku',
        'id',
        'product',
        'goods',
        'bn',
        'barCode',
      ]
      for (const key of keys) {
        const v = url.searchParams.get(key)
        if (v?.trim()) return v.trim()
      }
      const last = url.pathname.split('/').filter(Boolean).pop()
      if (last && /^[0-9A-Za-z\-_]{4,64}$/.test(last)) return last
    }
  } catch {
    /* ignore */
  }

  // JSON：{"barcode":"..."} / {"code":"..."}
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>
      for (const key of ['barcode', 'code', 'sku', 'barCode', 'productCode']) {
        const v = obj[key]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
    } catch {
      /* ignore */
    }
  }

  // 从长文本中提取连续数字条码（8~14 位常见）
  const digits = text.match(/\b\d{8,14}\b/)
  if (digits) return digits[0]

  return text
}
