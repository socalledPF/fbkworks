import { describe, expect, it } from 'vitest'
import { createPageRequest } from '../src/index'
import { formatNumber, formatMoney } from '@fbkworks/shared'

/**
 * 本轮评审修掉的两处「契约里写着、实现给不出来」。
 */

describe('createPageRequest 产出 hasMore', () => {
  /* 注意：config 里的 total 是**字段路径**（从响应里取总数），不是数字本身。
     只有在调用方声明了这个路径时，我们才有资格对 hasMore 下结论。 */
  const make = (total?: number) =>
    createPageRequest<any, { list: any[]; total?: number }>({
      fetch: async () => ({ list: [{ id: 1 }], total }),
      rows: (raw: any) => raw.list,
      ...(total === undefined ? {} : { total: 'total' }),
    })

  it('后端给了 total 时按 page*pageSize 算', async () => {
    const request = make(100)
    const first = await request({ page: 1, pageSize: 10, params: {} } as any)
    expect(first.hasMore, 'hasMore 没有产出，无限滚动只能靠「空页才结束」兜底').toBe(true)
    const last = await request({ page: 10, pageSize: 10, params: {} } as any)
    expect(last.hasMore).toBe(false)
  })

  it('后端没给 total 时不做结论（undefined），而不是谎报 false', async () => {
    const page = await make(undefined)({ page: 1, pageSize: 10, params: {} } as any)
    expect(page.hasMore).toBeUndefined()
  })
})

describe('formatNumber 不把假值当 0', () => {
  it('空白串 / 空数组 / 布尔 都显示占位符，而不是 0', async () => {
    /* 表格里最常见：CSV 导入的空白单元格、CHAR 列没 trim、后端给 []。 */
    expect(formatNumber('  '), '空白单元格被显示成 0').toBe('-')
    expect(formatNumber([])).toBe('-')
    expect(formatNumber(false)).toBe('-')
    expect(formatNumber(true)).toBe('-')
    expect(formatMoney('  '), '金额列被显示成 0.00').toBe('-')
  })

  it('真正的 0 与数字串照旧', async () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber('0')).toBe('0')
    expect(formatNumber('12.5')).toBe('12.5')
  })
})
