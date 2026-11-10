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

describe('isSuccess 的 falsy 返回值必须算失败', () => {
  /* 回归：曾经写成 `ok === false`，于是 isSuccess 返回 undefined / 0 / ''
     （`(res) => res.code`、`(res) => res.data?.ok`、`(res) => res.status` 的常见形态）
     全部被当成成功 —— 失败响应带空数组时用户看到「暂无数据」。 */
  it.each([
    ['undefined', () => undefined],
    ['0', () => 0],
    ['空字符串', () => ''],
    ['false', () => false],
  ])('返回 %s 时抛 FbkDataError 并上报', async (_label, isSuccess) => {
    const onError = vi.fn()
    const page = createPageRequest({
      fetch: async () => ({ list: [1, 2], total: 2 }),
      rows: 'list',
      total: 'total',
      isSuccess: isSuccess as any,
      onError,
    })
    await expect(page({ page: 1, pageSize: 20 } as any)).rejects.toThrow(FbkDataError)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('取消的多种真实形状都不上报', () => {
  const shapes = [
    ['DOMException AbortError', Object.assign(new Error('aborted'), { name: 'AbortError' })],
    ['axios CanceledError', Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' })],
    ['只有 ERR_CANCELED code', Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })],
    ['abort(customReason) 任意形状', new Error('because why not')],
  ]

  it.each(shapes)('%s（signal 已 abort）不上报', async (_label, err) => {
    const onError = vi.fn()
    const page = createPageRequest({
      fetch: async () => {
        throw err
      },
      rows: 'list',
      total: 'total',
      onError,
    })
    await expect(page({ page: 1, pageSize: 20, signal: { aborted: true } } as any)).rejects.toThrow()
    expect(onError, '取消被当成错误上报了').not.toHaveBeenCalled()
  })

  it('signal 没 abort 时照样上报 —— 不能一律吞掉', async () => {
    const onError = vi.fn()
    const page = createPageRequest({
      fetch: async () => {
        throw new Error('boom')
      },
      rows: 'list',
      total: 'total',
      onError,
    })
    await expect(page({ page: 1, pageSize: 20, signal: { aborted: false } } as any)).rejects.toThrow()
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('total 必须是非负整数', () => {
  it.each([
    ['负数', -5],
    ['小数', 1.5],
    ['数字字符串小数', '2.5'],
  ])('拒绝 %s', async (_label, total) => {
    const page = createPageRequest({
      fetch: async () => ({ list: [1], total }),
      rows: 'list',
      total: 'total',
    })
    await expect(page({ page: 1, pageSize: 20 } as any)).rejects.toThrow(FbkDataError)
  })

  it('0 是合法的', async () => {
    const page = createPageRequest({
      fetch: async () => ({ list: [], total: 0 }),
      rows: 'list',
      total: 'total',
    })
    await expect(page({ page: 1, pageSize: 20 } as any)).resolves.toMatchObject({ total: 0 })
  })
})

