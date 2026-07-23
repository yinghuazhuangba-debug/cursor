import type { Product } from '../types'

/** 简单中文/拼音友好的名称模糊匹配（包含、前缀加权） */
export function fuzzyMatchProducts(
  products: Product[],
  query: string,
  limit = 8,
): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = products
    .map((p) => {
      const name = p.name.toLowerCase()
      let score = 0
      if (name === q) score = 100
      else if (name.startsWith(q)) score = 80
      else if (name.includes(q)) score = 50
      else {
        // 逐字包含（适合「农泉」匹配「农夫山泉」这类简写较弱场景：要求每个字都在名称中）
        const chars = [...q]
        if (chars.length >= 2 && chars.every((c) => name.includes(c))) {
          score = 30
        }
      }
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'zh-CN'))

  return scored.slice(0, limit).map((x) => x.p)
}
