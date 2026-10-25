/**
 * mock 后端：把内存数组当成真实服务端来用。
 *
 * **这个文件模拟的是后端，不是业务代码。**
 * 真实项目里它不存在 —— 对应的是 HTTP 请求。
 * 把它单独放，是为了让 data.ts 里的业务代码量可诚实对比。
 */

import type { PageQuery } from '@fbk/data'

/** 确定性伪随机，保证每次刷新数据一致 */
export function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export const rand = makeRandom(20261022)

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!
export const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1))

/** 模拟网络延迟，并响应 AbortSignal */
export function delay(signal?: AbortSignal, base = 150, spread = 300): Promise<void> {
  const ms = base + Math.floor(Math.random() * spread)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    })
  })
}

/**
 * 内存表分页：筛选 → 排序 → 分页。
 * 真实后端做这件事，前端不需要写。
 */
export async function mockServerQuery<TRow extends Record<string, any>>(
  table: TRow[],
  query: PageQuery,
  options: {
    searchFields?: Array<keyof TRow>
    equals?: Array<keyof TRow>
  } = {},
): Promise<{ rows: TRow[]; total: number }> {
  await delay(query.signal)

  let rows = table.slice()
  const { keyword, dateRange, ...rest } = query.params as Record<string, any>

  if (keyword && options.searchFields?.length) {
    const kw = String(keyword).trim().toLowerCase()
    rows = rows.filter((row) =>
      options.searchFields!.some((f) => String(row[f] ?? '').toLowerCase().includes(kw)),
    )
  }

  for (const field of options.equals ?? []) {
    const value = rest[field as string]
    if (value !== undefined && value !== null && value !== '') {
      rows = rows.filter((row) => String(row[field]) === String(value))
    }
  }

  if (dateRange?.[0] && dateRange?.[1]) {
    rows = rows.filter((row) => {
      const d = String(row.createdAt).slice(0, 10)
      return d >= dateRange[0] && d <= dateRange[1]
    })
  }

  if (query.sort?.order) {
    const { field, order } = query.sort
    rows.sort((a, b) => {
      const av = a[field]
      const bv = b[field]
      if (av === bv) return 0
      const result = av > bv ? 1 : -1
      return order === 'desc' ? -result : result
    })
  }

  const total = rows.length
  const start = (query.page - 1) * query.pageSize
  return { rows: rows.slice(start, start + query.pageSize), total }
}
