import { describe, expect, it } from 'vitest'
import { createPageRequest } from '../src/create'
import type { PageQuery, PageRequestErrorEvent } from '../src/types'

/** raw / rawPreview 的口径：默认安全，显式开启才收集完整响应。 */

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

describe('includeRaw：显式开启才收集完整响应', () => {
  const big = { code: 500, msg: '炸了', rows: Array.from({ length: 500 }, (_, i) => ({ id: i, phone: '13800000000' })) }

  it('默认: raw 为 undefined，rawPreview 有值且被截断', async () => {
    const { events, onError } = collect()
    const request = createPageRequest<any, unknown>({
      fetch: async () => big,
      rows: 'rows',
      isSuccess: () => false,
      errorMessage: () => '炸了',
      onError,
    })
    await expect(request(query)).rejects.toThrow('炸了')
    expect(events[0]!.raw).toBeUndefined()
    expect(events[0]!.rawPreview).toBeTruthy()
    expect((events[0]!.rawPreview as string).length).toBeLessThanOrEqual(600)
    /* 默认路径的体积上限：500 行的响应体不该有任何机会进事件。
       这是防止将来又有人往事件里塞大对象的最后一道尺子。 */
    expect(JSON.stringify(events[0]).length, '默认事件被响应体撑爆了').toBeLessThan(4000)
  })

  it('开启后 raw 是原始对象，可读 raw.code 做分支；事件体积仍受限', async () => {
    const { events, onError } = collect()
    const request = createPageRequest<any, typeof big>({
      fetch: async () => big,
      rows: 'rows',
      isSuccess: () => false,
      errorMessage: () => '炸了',
      includeRaw: true,
      onError,
    })
    await expect(request(query)).rejects.toThrow('炸了')
    expect((events[0]!.raw as any).code).toBe(500)
    /* 这里**不**断言体积：显式开启就是要把完整响应拿到手，几十 KB 是它的正常形态。
       默认路径的体积上限见上一条用例。 */
  })
})
