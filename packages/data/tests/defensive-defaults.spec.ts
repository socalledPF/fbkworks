import { describe, expect, it, vi } from 'vitest'
import { defineBackend } from '../src/backend'
import { createPageRequest } from '../src/create'
import { FbkDataError } from '../src/error'

/**
 * 这三条都对应 review 里确认过的真实缺陷。共同点：**默认值被静默关掉**，
 * 表面看不出来，只会在某个后端上表现为「分页器永远 0 条」或「失败当空列表」。
 */

describe('显式 undefined 不得覆盖后端惯例', () => {
  it('page(url, { total: undefined }) 仍然用后端惯例解析总数', async () => {
    /* 以前 { ...defaults, ...options } 会把 total 覆盖成 undefined，
       于是走兜底的 rows.length（2），而不是后端的 57。 */
    const api = defineBackend({
      request: async () => ({ data: { list: [{ id: 1 }, { id: 2 }], total: 57 } }),
      rows: 'data.list',
      total: 'data.total',
    })
    const page = api.page('/any', { total: undefined })
    const result = await page({ page: 1, pageSize: 20 } as any)
    expect(result.total).toBe(57)
    expect(result.list).toHaveLength(2)
  })

  it('isSuccess: undefined 不会关掉业务码判定', async () => {
    const api = defineBackend({
      request: async () => ({ code: 500, msg: 'token 过期', data: { list: [], total: 0 } }),
      rows: 'data.list',
      total: 'data.total',
      isSuccess: (raw: any) => raw.code === 200,
      errorMessage: (raw: any) => raw.msg,
    })
    const page = api.page('/any', { isSuccess: undefined })
    await expect(page({ page: 1, pageSize: 20 } as any)).rejects.toThrow(FbkDataError)
  })
})

describe('isSuccess 自身抛错必须被上报', () => {
  it('空 body 时不吞成裸 TypeError，而是上报并抛 FbkDataError', async () => {
    const onError = vi.fn()
    const page = createPageRequest({
      fetch: async () => null as any,
      rows: (raw: any) => raw.list,
      total: (raw: any) => raw.total,
      isSuccess: (raw: any) => raw.code === 200,
      onError,
    })
    await expect(page({ page: 1, pageSize: 20 } as any)).rejects.toThrow(FbkDataError)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('total 的严格解析', () => {
  it.each([
    ['纯空白字符串', '  '],
    ['空数组', []],
    ['布尔值', false],
  ])('拒绝 %s —— 不能静默变成 0', async (_label, total) => {
    const page = createPageRequest({
      fetch: async () => ({ list: [{ id: 1 }], total }),
      rows: 'list',
      total: 'total',
    })
    await expect(page({ page: 1, pageSize: 20 } as any)).rejects.toThrow(FbkDataError)
  })

  it('数字字符串照常接受', async () => {
    const page = createPageRequest({
      fetch: async () => ({ list: [{ id: 1 }], total: '57' }),
      rows: 'list',
      total: 'total',
    })
    const result = await page({ page: 1, pageSize: 20 } as any)
    expect(result.total).toBe(57)
  })
})
