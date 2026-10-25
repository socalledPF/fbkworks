import { describe, expect, it, vi } from 'vitest'
import { createPageRequest } from '../src/create'
import type { PageQuery, PageRequestErrorEvent } from '../src/types'

/**
 * 错误上报。
 *
 * 三条错误路径都要走到：网络失败、业务码失败、路径解析失败。
 * 一条最重要的**不该**上报：AbortError —— 取消是正常流程，
 * 当成错误上报会让监控充满噪音（快速翻页时每页都会产生一条）。
 */

const query: PageQuery = {
  page: 1,
  pageSize: 20,
  sort: null,
  params: { keyword: 'x' },
  signal: new AbortController().signal,
}

const collect = () => {
  const events: PageRequestErrorEvent[] = []
  return { events, onError: (e: PageRequestErrorEvent) => events.push(e) }
}

describe('网络层错误', () => {
  it('fetch 抛错时上报并重新抛出', async () => {
    const { events, onError } = collect()
    const request = createPageRequest({
      fetch: async () => {
        throw new Error('网络超时')
      },
      rows: 'rows',
      feature: 'order.list',
      onError,
    })

    await expect(request(query)).rejects.toThrow('网络超时')
    expect(events).toHaveLength(1)
    expect(events[0]!.message).toBe('网络超时')
    expect(events[0]!.feature).toBe('order.list')
    expect(events[0]!.source).toBe('request')
  })

  it('上报里带参数快照，便于复现', async () => {
    const { events, onError } = collect()
    const request = createPageRequest({
      fetch: async () => {
        throw new Error('x')
      },
      rows: 'rows',
      onError,
    })
    await expect(request(query)).rejects.toThrow()
    expect(events[0]!.context).toMatchObject({
      page: 1,
      pageSize: 20,
      params: { keyword: 'x' },
    })
  })

  it('AbortError 不上报（取消不是错误）', async () => {
    const { events, onError } = collect()
    const request = createPageRequest({
      fetch: async () => {
        throw new DOMException('请求已取消', 'AbortError')
      },
      rows: 'rows',
      onError,
    })

    await expect(request(query)).rejects.toThrow('请求已取消')
    // 关键断言：取消不该产生监控噪音
    expect(events).toHaveLength(0)
  })
})

describe('业务码失败', () => {
  it('上报并带上原始响应', async () => {
    const { events, onError } = collect()
    const request = createPageRequest<any, unknown>({
      fetch: async () => ({ code: 401, msg: '登录已过期', rows: [] }),
      rows: 'rows',
      isSuccess: (res) => res.code === 200,
      errorMessage: (res) => res.msg,
      feature: 'order.list',
      onError,
    })

    await expect(request(query)).rejects.toThrow('登录已过期')
    expect(events).toHaveLength(1)
    expect(events[0]!.message).toBe('登录已过期')
    expect(events[0]!.raw).toMatchObject({ code: 401 })
  })
})

describe('路径解析失败', () => {
  it('字段名写错时上报（这是开发期错误，但线上也会发生）', async () => {
    const { events, onError } = collect()
    const request = createPageRequest({
      fetch: async () => ({ data: [] }),
      rows: 'rows',
      feature: 'order.list',
      onError,
    })

    await expect(request(query)).rejects.toThrow()
    expect(events).toHaveLength(1)
    expect(events[0]!.message).toContain('rows')
    // 路径错误也要带 raw，否则排查要重新抓包
    expect(events[0]!.raw).toEqual({ data: [] })
  })
})

describe('上报器本身', () => {
  it('未传 onError 时零开销且不报错', async () => {
    const request = createPageRequest({
      fetch: async () => ({ rows: [{ id: 1 }] }),
      rows: 'rows',
    })
    await expect(request(query)).resolves.toBeTruthy()
  })

  it('onError 自身抛错不影响业务请求', async () => {
    const request = createPageRequest({
      fetch: async () => ({ code: 500, msg: 'err', rows: [] }),
      rows: 'rows',
      isSuccess: () => false,
      errorMessage: () => '业务失败',
      onError: () => {
        throw new Error('上报服务挂了')
      },
    })
    // 上报器崩了，但业务侧的 FbkDataError 仍然正常抛出
    await expect(request(query)).rejects.toThrow('业务失败')
  })

  it('成功时不产生任何事件', async () => {
    const onError = vi.fn()
    const request = createPageRequest({
      fetch: async () => ({ rows: [{ id: 1 }], total: 1 }),
      rows: 'rows',
      total: 'total',
      onError,
    })
    await request(query)
    expect(onError).not.toHaveBeenCalled()
  })
})
