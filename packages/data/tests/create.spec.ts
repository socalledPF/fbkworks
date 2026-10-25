import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWarnCache } from '@fbk/shared'
import { createPageRequest, toTableResponse } from '../src/create'
import { FbkDataError } from '../src/error'
import type { PageQuery } from '../src/types'

/**
 * createPageRequest 的核心行为。
 *
 * 覆盖三类后端形态：
 *   1. ruoyi 风格：{ code, msg, rows, total } + 业务码
 *   2. Spring 风格：{ content, totalElements } + 无业务码
 *   3. 直接返回数组（无分页信息）
 */

const query: PageQuery = {
  page: 2,
  pageSize: 10,
  sort: null,
  params: { keyword: 'abc' },
  signal: new AbortController().signal,
}

beforeEach(() => {
  resetWarnCache()
})

describe('ruoyi 风格响应', () => {
  const makeRequest = () =>
    createPageRequest<any, { id: number }>({
      fetch: async () => ({ code: 200, msg: 'ok', rows: [{ id: 1 }, { id: 2 }], total: 128 }),
      rows: 'rows',
      total: 'total',
      isSuccess: (res) => res.code === 200,
      errorMessage: (res) => res.msg,
      scope: 'server-filtered',
    })

  it('解析出 list 与 total', async () => {
    const result = await makeRequest()(query)
    expect(result.list).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.total).toBe(128)
  })

  it('业务码失败时抛 FbkDataError 且带后端消息', async () => {
    const request = createPageRequest<any, unknown>({
      fetch: async () => ({ code: 401, msg: '登录已过期', rows: [], total: 0 }),
      rows: 'rows',
      isSuccess: (res) => res.code === 200,
      errorMessage: (res) => res.msg,
    })
    await expect(request(query)).rejects.toThrow(FbkDataError)
    await expect(request(query)).rejects.toThrow('登录已过期')
  })

  it('业务失败不会被当成空列表', async () => {
    // 这条防的是「token 过期时用户看到暂无数据」
    const request = createPageRequest<any, unknown>({
      fetch: async () => ({ code: 500, msg: '服务器错误', rows: [], total: 0 }),
      rows: 'rows',
      isSuccess: (res) => res.code === 200,
      errorMessage: (res) => res.msg,
    })
    await expect(request(query)).rejects.toThrow()
  })
})

describe('Spring 风格响应', () => {
  it('解析 content / totalElements', async () => {
    const request = createPageRequest({
      fetch: async () => ({ content: [{ id: 1 }], totalElements: 57 }),
      rows: 'content',
      total: 'totalElements',
    })
    const result = await request(query)
    expect(result.list).toEqual([{ id: 1 }])
    expect(result.total).toBe(57)
  })
})

describe('嵌套路径', () => {
  it('支持 data.records', async () => {
    const request = createPageRequest({
      fetch: async () => ({ data: { records: [{ id: 9 }], count: 3 } }),
      rows: 'data.records',
      total: 'data.count',
    })
    const result = await request(query)
    expect(result.list).toEqual([{ id: 9 }])
    expect(result.total).toBe(3)
  })
})

describe('无分页信息的响应', () => {
  it('不传 total 时用 rows.length', async () => {
    const request = createPageRequest({
      fetch: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      rows: (raw: unknown) => raw,
    })
    const result = await request(query)
    expect(result.list).toHaveLength(3)
    expect(result.total).toBe(3)
  })
})

describe('mapRow', () => {
  it('逐行转换并传入 index', async () => {
    const request = createPageRequest<any, string>({
      fetch: async () => ({ rows: [{ name: 'a' }, { name: 'b' }] }),
      rows: 'rows',
      mapRow: (raw, index) => `${index}:${(raw as any).name}`,
    })
    const result = await request(query)
    expect(result.list).toEqual(['0:a', '1:b'])
  })
})

describe('AbortSignal', () => {
  it('取消时抛 AbortError，不被吞掉', async () => {
    // 不吞异常是关键：use-table-request 依赖 AbortError 判断「该丢弃响应」
    const controller = new AbortController()
    const request = createPageRequest({
      fetch: async () => {
        controller.abort()
        throw new DOMException('请求已取消', 'AbortError')
      },
      rows: 'rows',
    })
    await expect(request({ ...query, signal: controller.signal })).rejects.toThrow('请求已取消')
  })

  it('把 signal 透传给 fetch', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.fn(async () => ({ rows: [] }))
    const request = createPageRequest({ fetch: fetchSpy, rows: 'rows' })

    await request({ ...query, signal: controller.signal })
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }))
  })

  it('透传 page / pageSize / params', async () => {
    const fetchSpy = vi.fn(async () => ({ rows: [] }))
    const request = createPageRequest({ fetch: fetchSpy, rows: 'rows' })

    await request(query)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, params: { keyword: 'abc' } }),
    )
  })
})

describe('数据级权限提醒', () => {
  it('scope 为 client-filtered 时告警', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const request = createPageRequest({
      fetch: async () => ({ rows: [] }),
      rows: 'rows',
      scope: 'client-filtered',
    })
    // 告警在创建时触发，不在调用时
    expect(warn).toHaveBeenCalled()
    const text = String(warn.mock.calls[0]?.[0] ?? '')
    expect(text).toContain('服务端过滤')
    warn.mockRestore()
    await request(query)
  })

  it('scope 为 server-filtered 时静默', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createPageRequest({
      fetch: async () => ({ rows: [] }),
      rows: 'rows',
      scope: 'server-filtered',
    })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('toTableResponse', () => {
  it('保持结构兼容', () => {
    expect(toTableResponse({ list: [1], total: 1 })).toEqual({ list: [1], total: 1 })
  })

  it('透传 hasMore', () => {
    expect(toTableResponse({ list: [], total: 0, hasMore: false }).hasMore).toBe(false)
  })
})
