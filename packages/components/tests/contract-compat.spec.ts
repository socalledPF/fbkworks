import { describe, expect, expectTypeOf, it } from 'vitest'
import type { SortState } from '@fbk/adapter-core'
import type { Page, PageFetcher, PageQuery, PageSort } from '@fbk/data'
import type { TableRequest, TableRequestParams, TableResponse } from '../src/pro-table/types'

/**
 * 契约一致性（跨包）。
 *
 * 把「@fbk/data 与 @fbk/components 的分页契约同形」从**注释里的承诺**
 * 变成**编译期检查**。
 *
 * 背景：之前两处各写一份同形接口，注释声称「保证 TableRequest 能无缝迁移」，
 * 但实际改一处另一处不会报错 —— 注释会继续说兼容，而代码已经坏了。
 * 现在 components 直接别名到 data，这些断言防止有人改回去。
 *
 * 为什么放在 components 而不是 data：data 是被依赖方，
 * 让它反过来依赖 components 会形成环。
 */

describe('PageSort 与 SortState', () => {
  it('结构完全可互换', () => {
    expectTypeOf<PageSort>().toEqualTypeOf<SortState>()
  })
})

describe('PageQuery 与 TableRequestParams', () => {
  it('是同一个类型', () => {
    expectTypeOf<TableRequestParams>().toEqualTypeOf<PageQuery>()
  })

  it('双向可赋值', () => {
    const query: PageQuery = {
      page: 1,
      pageSize: 20,
      sort: null,
      params: {},
      signal: new AbortController().signal,
    }
    expectTypeOf(query).toMatchTypeOf<TableRequestParams>()
    expect(query.page).toBe(1)
  })
})

describe('Page 与 TableResponse', () => {
  it('Page 可以赋给 TableResponse（total 由必填放宽为可选）', () => {
    expectTypeOf<Page<{ id: number }>>().toMatchTypeOf<TableResponse<{ id: number }>>()
  })

  it('TableResponse 不能当 Page（total 可能缺失）', () => {
    // 方向性差异是有意的：业务方手写 fetcher 时可能拿不到总数
    expectTypeOf<TableResponse<{ id: number }>>().not.toMatchTypeOf<Page<{ id: number }>>()
  })
})

describe('PageFetcher 与 TableRequest', () => {
  it('createPageRequest 的产物可直接喂给 ProTable', () => {
    // 整个契约层最重要的兼容性承诺
    expectTypeOf<PageFetcher<{ id: number }>>().toMatchTypeOf<TableRequest<{ id: number }>>()
  })

  it('反过来不成立', () => {
    expectTypeOf<TableRequest<{ id: number }>>().not.toMatchTypeOf<PageFetcher<{ id: number }>>()
  })
})

describe('运行时兜底', () => {
  it('total 缺失是合法状态，组件负责兜底', () => {
    const response: TableResponse<number> = { list: [1, 2, 3] }
    expect(response.total).toBeUndefined()
    expect(response.list).toHaveLength(3)
  })
})
