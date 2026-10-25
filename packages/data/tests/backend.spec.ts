import { describe, expect, it, vi } from 'vitest'
import { defineBackend } from '../src/backend'
import { FbkDataError } from '../src/error'
import type { PageQuery } from '../src/types'

/**
 * defineBackend —— 后端惯例复用。
 *
 * 核心价值：一个 Spring 项目有 12 个列表接口时，后端惯例只写一次。
 * 这个文件验证「复用真的成立」以及「覆盖真的生效」。
 */

const query = (extra: Partial<PageQuery> = {}): PageQuery => ({
  page: 2,
  pageSize: 20,
  sort: null,
  params: { keyword: 'abc' },
  signal: new AbortController().signal,
  ...extra,
})

/** Spring 风格的响应 */
const springResponse = (rows: unknown[]) => ({
  code: 200,
  msg: 'ok',
  content: rows,
  totalElements: 128,
})

describe('A 形态：传路径', () => {
  it('用后端惯例的 request 发请求', async () => {
    const request = vi.fn(async (_url: string, _params: Record<string, any>, _signal: AbortSignal) => springResponse([{ id: 1 }]))
    const api = defineBackend({ request, rows: 'content', total: 'totalElements' })

    const fetchOrders = api.page('/api/order/list')
    const result = await fetchOrders(query())

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![0]).toBe('/api/order/list')
    expect(result.list).toEqual([{ id: 1 }])
    expect(result.total).toBe(128)
  })

  it('把 PageQuery 转成后端参数名（默认 page/pageSize）', async () => {
    const request = vi.fn(async (_url: string, _params: Record<string, any>, _signal: AbortSignal) => springResponse([]))
    const api = defineBackend({ request, rows: 'content', total: 'totalElements' })

    await api.page('/api/list')(query())

    const params = request.mock.calls[0]![1] as Record<string, any>
    expect(params).toMatchObject({ page: 2, pageSize: 20, keyword: 'abc' })
  })

  it('透传 AbortSignal', async () => {
    const request = vi.fn(async (_url: string, _params: Record<string, any>, _signal: AbortSignal) => springResponse([]))
    const api = defineBackend({ request, rows: 'content', total: 'totalElements' })
    const signal = new AbortController().signal

    await api.page('/api/list')(query({ signal }))

    expect(request.mock.calls[0]![2]).toBe(signal)
  })
})

describe('B 形态：传 fetcher', () => {
  it('绕过 request 自己发请求', async () => {
    const request = vi.fn(async () => springResponse([]))
    const api = defineBackend({ request, rows: 'content', total: 'totalElements' })

    const customFetcher = vi.fn(async () => springResponse([{ id: 9 }]))
    const result = await api.page(customFetcher)(query())

    // 后端的 request 不该被调用
    expect(request).not.toHaveBeenCalled()
    expect(customFetcher).toHaveBeenCalledTimes(1)
    expect(result.list).toEqual([{ id: 9 }])
  })

  it('仍然使用后端的 rows/total 配置', async () => {
    const api = defineBackend({
      request: vi.fn(async () => springResponse([])),
      rows: 'content',
      total: 'totalElements',
    })
    const result = await api.page(async () => springResponse([{ id: 1 }]))(query())

    // 逃生口只接管「怎么发请求」，解析仍走后端惯例
    expect(result.total).toBe(128)
  })
})

describe('接口级覆盖', () => {
  it('覆盖后端的 rows', async () => {
    const api = defineBackend({
      request: vi.fn(async () => ({ rows: [{ id: 1 }], total: 5 })),
      rows: 'content',
      total: 'totalElements',
    })

    // 这个老接口用 rows/total
    const fetchLegacy = api.page('/api/legacy', { rows: 'rows', total: 'total' })
    const result = await fetchLegacy(query())

    expect(result.list).toEqual([{ id: 1 }])
    expect(result.total).toBe(5)
  })

  it('覆盖业务码判定（不同接口用不同 code 约定）', async () => {
    const api = defineBackend({
      request: vi.fn(async () => ({ code: 0, content: [{ id: 1 }], totalElements: 1 })),
      rows: 'content',
      total: 'totalElements',
      // 默认认为 200 成功
      isSuccess: (res: any) => res.code === 200,
    })

    // 这个接口用 code === 0
    const fetchOdd = api.page('/api/odd', { isSuccess: (res: any) => res.code === 0 })
    const result = await fetchOdd(query())

    expect(result.list).toHaveLength(1)
  })

  it('后端默认配置在未覆盖时生效', async () => {
    const api = defineBackend({
      request: vi.fn(async () => ({ code: 500, msg: '服务异常', content: [], totalElements: 0 })),
      rows: 'content',
      total: 'totalElements',
      isSuccess: (res: any) => res.code === 200,
      errorMessage: (res: any) => res.msg,
    })

    await expect(api.page('/api/list')(query())).rejects.toThrow('服务异常')
  })
})

describe('mapParams', () => {
  it('能把 page 映射成 pageNum', async () => {
    const request = vi.fn(async (_url: string, _params: Record<string, any>, _signal: AbortSignal) => springResponse([]))
    const api = defineBackend({
      request,
      rows: 'content',
      total: 'totalElements',
      mapParams: ({ page, pageSize, params }) => ({
        pageNum: page,
        pageSize,
        ...params,
      }),
    })

    await api.page('/api/list')(query())

    const params = request.mock.calls[0]![1] as Record<string, any>
    expect(params.pageNum).toBe(2)
    // 原本的 page 键不该出现
    expect(params.page).toBeUndefined()
    expect(params.keyword).toBe('abc')
  })

  it('B 形态不经过 mapParams（fetcher 自己管参数）', async () => {
    const mapParams = vi.fn(() => ({ x: 1 }))
    const api = defineBackend({
      request: vi.fn(async () => springResponse([])),
      rows: 'content',
      mapParams,
    })

    const fetcher = vi.fn(async () => springResponse([]))
    await api.page(fetcher)(query())

    // 逃生口的 fetcher 只拿到 PageQuery，不需要后端参数名
    expect(mapParams).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
  })
})

describe('错误传播', () => {
  it('业务码失败抛 FbkDataError', async () => {
    const api = defineBackend({
      request: vi.fn(async () => ({ code: 401, msg: '登录已过期', content: [], totalElements: 0 })),
      rows: 'content',
      total: 'totalElements',
      isSuccess: (res: any) => res.code === 200,
      errorMessage: (res: any) => res.msg,
    })

    await expect(api.page('/api/list')(query())).rejects.toThrow(FbkDataError)
  })

  it('onError 从后端配置继承', async () => {
    const onError = vi.fn()
    const api = defineBackend({
      request: vi.fn(async () => ({ code: 500, content: [], totalElements: 0 })),
      rows: 'content',
      total: 'totalElements',
      isSuccess: () => false,
      errorMessage: () => '失败',
      onError,
    })

    await expect(api.page('/api/list', { feature: 'order.list' })(query())).rejects.toThrow()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0].feature).toBe('order.list')
  })

  it('network 错误原样抛出', async () => {
    const api = defineBackend({
      request: vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
      rows: 'content',
    })

    await expect(api.page('/api/list')(query())).rejects.toThrow('ECONNREFUSED')
  })

  it('AbortError 不上报', async () => {
    const onError = vi.fn()
    const api = defineBackend({
      request: vi.fn(async () => {
        throw new DOMException('已取消', 'AbortError')
      }),
      rows: 'content',
      onError,
    })

    await expect(api.page('/api/list')(query())).rejects.toThrow('已取消')
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('复用验证（真实场景）', () => {
  it('12 个接口共用一份后端配置', async () => {
    const request = vi.fn(async (_url: string, _params: Record<string, any>, _signal: AbortSignal) => springResponse([{ id: 1 }]))
    const api = defineBackend({
      request,
      rows: 'content',
      total: 'totalElements',
      isSuccess: (res: any) => res.code === 200,
      errorMessage: (res: any) => res.msg,
      scope: 'server-filtered',
    })

    // 模拟 12 个接口，每个只写自己的信息
    const endpoints = Array.from({ length: 12 }, (_, i) =>
      api.page(`/api/resource${i}/list`, { feature: `resource${i}.list` }),
    )

    for (const fn of endpoints) {
      const result = await fn(query())
      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(128)
    }

    expect(request).toHaveBeenCalledTimes(12)
  })

  it('config 暴露底层配置，便于跨模块复用', () => {
    const request = vi.fn(async () => springResponse([]))
    const api = defineBackend({ request, rows: 'content', total: 'totalElements' })

    expect(api.config.request).toBe(request)
    expect(api.config.rows).toBe('content')
  })
})

describe('向后兼容', () => {
  it('createPageRequest 完全不受影响（defineBackend 是叠加的）', async () => {
    const { createPageRequest } = await import('../src/create')
    const fetcher = createPageRequest({
      fetch: async () => ({ rows: [{ id: 1 }], total: 1 }),
      rows: 'rows',
      total: 'total',
    })
    const result = await fetcher(query())
    expect(result.list).toHaveLength(1)
  })
})
