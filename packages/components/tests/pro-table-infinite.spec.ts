import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMockAdapter, mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'

const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]

/** 每页两行，只关心 id：断言「追加了哪几行」比断言整行对象更直观 */
const pageRows: Record<number, number[]> = { 1: [10, 11], 2: [20, 21], 3: [30, 31] }

/** 带关键字筛选后只剩 1 页：停在第 2、3 页查它会得到空列表，正是要防的场景 */
const filteredRows: Record<number, number[]> = { 1: [40, 41] }

const toRows = (ids: number[]) => ids.map((id) => ({ id, name: `row-${id}` }))

function createRequest() {
  return vi.fn(async ({ page }: { page: number }) => ({
    list: toRows(pageRows[page] ?? []),
    total: 6,
    hasMore: page < 2,
  }))
}

function createFilterRequest() {
  return vi.fn(async ({ page, params }: { page: number; params?: Record<string, any> }) => {
    const filtered = params?.keyword === 'k'
    return {
      list: toRows((filtered ? filteredRows[page] : pageRows[page]) ?? []),
      total: 6,
      hasMore: filtered ? false : page < 3,
    }
  })
}

function mountTable(
  options: {
    adapter?: ReturnType<typeof createMockAdapter>
    props?: Record<string, any>
    request?: ReturnType<typeof createRequest>
  } = {},
) {
  const request = options.request ?? createRequest()
  const wrapper = mountWithAdapter(FbkProTable, {
    adapter: options.adapter ?? createMockAdapter(),
    props: { columns, request, rowKey: 'id', ...options.props },
  })

  /** 每次请求的页码：一次触发发两个请求，在这里就是重复的页码 */
  const pages = () => request.mock.calls.map((call) => (call[0] as any).page)
  const rowIds = () =>
    wrapper
      .findAll('[data-fbk-part="grid-row"]')
      .map((row) => Number(row.attributes('data-row-key')))
  const grid = () => wrapper.findComponent({ name: 'MockDataGrid' })
  /** 分页条上显示的页码 */
  const shownPage = () =>
    Number(wrapper.find('[data-fbk-part="pagination"]').attributes('data-page'))
  const nextPage = () => wrapper.find('[data-fbk-part="next"]').trigger('click')
  const reload = (reloadOptions?: { resetPage?: boolean }) =>
    (wrapper.findComponent(FbkProTable).vm as any).reload(reloadOptions)

  return { wrapper, request, pages, rowIds, grid, shownPage, nextPage, reload }
}

function mountInfinite(options: { request?: ReturnType<typeof createRequest> } = {}) {
  return mountTable({
    adapter: createMockAdapter({ pagination: { mode: 'infinite' } }),
    ...options,
  })
}

describe('FbkProTable 无限滚动', () => {
  it('一次触底只发一个请求，并把新一页追加在后面', async () => {
    const table = mountInfinite()
    await flushPromises()
    expect(table.rowIds()).toEqual([10, 11])

    table.grid().vm.$emit('load-more')
    await flushPromises()

    // 首屏被 page=2 覆盖成 [20, 21]；pages 双发时是 [1, 2, 2]
    expect(table.rowIds()).toEqual([10, 11, 20, 21])
    expect(table.pages()).toEqual([1, 2])
  })

  it('快速连续触底不产生重复请求', async () => {
    const table = mountInfinite()
    await flushPromises()

    table.grid().vm.$emit('load-more')
    table.grid().vm.$emit('load-more')
    table.grid().vm.$emit('load-more')
    await flushPromises()

    expect(table.pages()).toEqual([1, 2])
    expect(table.rowIds()).toEqual([10, 11, 20, 21])
  })

  it('触底到最后一页后 finished 为 true 且不再请求', async () => {
    const table = mountInfinite()
    await flushPromises()
    expect(table.grid().props('finished')).toBe(false)

    table.grid().vm.$emit('load-more')
    await flushPromises()
    expect(table.grid().props('finished')).toBe(true)

    table.grid().vm.$emit('load-more')
    await flushPromises()
    expect(table.pages()).toEqual([1, 2])
  })

  it('改排序回到第一页且是替换，不拼接旧数据', async () => {
    const table = mountInfinite()
    await flushPromises()
    table.grid().vm.$emit('load-more')
    await flushPromises()
    table.request.mockClear()

    table.grid().vm.$emit('update:sort', { key: 'name', order: 'desc' })
    await flushPromises()

    expect(table.pages()).toEqual([1])
    expect(table.rowIds()).toEqual([10, 11])
  })

  it('改筛选是替换，不拼接旧数据', async () => {
    const table = mountInfinite()
    await flushPromises()

    await table.wrapper.setProps({ params: { keyword: 'k' } })
    await flushPromises()

    expect(table.pages()).toEqual([1, 1])
    expect(table.request.mock.calls.at(-1)?.[0]).toMatchObject({ params: { keyword: 'k' } })
    expect(table.rowIds()).toEqual([10, 11])
  })
})

describe('FbkProTable 请求单发（分页模式）', () => {
  it('reload({ resetPage: true }) 只发一个请求', async () => {
    const table = mountInfinite()
    await flushPromises()
    table.grid().vm.$emit('load-more')
    await flushPromises()
    table.request.mockClear()

    await table.reload({ resetPage: true })
    await flushPromises()

    expect(table.pages()).toEqual([1])
    expect(table.rowIds()).toEqual([10, 11])
  })

  it('reload({ resetPage: true }) 从第 2 页回到第 1 页也只发一个请求', async () => {
    const table = mountTable()
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    table.request.mockClear()

    await table.reload({ resetPage: true })
    await flushPromises()

    expect(table.pages()).toEqual([1])
  })

  it('外部改页码仍然重新查：watch 不能被过度抑制', async () => {
    const table = mountTable({ props: { page: 1 } })
    await flushPromises()

    await table.wrapper.setProps({ page: 2 })
    await flushPromises()

    expect(table.pages()).toEqual([1, 2])
  })
})

describe('FbkProTable 筛选条件变化回到第一页', () => {
  it('第 2 页时改筛选：回到第 1 页且只发一个请求', async () => {
    const table = mountTable({ request: createFilterRequest() })
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    expect(table.pages()).toEqual([1, 2])
    table.request.mockClear()

    await table.wrapper.setProps({ params: { keyword: 'k' } })
    await flushPromises()

    // 修复前页码留在 2：这里会是 [2]
    expect(table.pages()).toEqual([1])
    expect(table.rowIds()).toEqual([40, 41])
    // 分页条也得回到第 1 页，否则用户看到的是「第 2 页 / 共 1 页」
    expect(table.shownPage()).toBe(1)
  })

  it('第 3 页时改筛选：拿到新条件第 1 页的数据，而不是空列表', async () => {
    const table = mountTable({ request: createFilterRequest() })
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    expect(table.rowIds()).toEqual([30, 31])
    table.request.mockClear()

    await table.wrapper.setProps({ params: { keyword: 'k' } })
    await flushPromises()

    // 修复前：page=3 的新条件没有结果，用户看到「暂无数据」
    expect(table.rowIds()).toEqual([40, 41])
    expect(table.pages()).toEqual([1])
  })

  it('第 2 页时改排序：回到第 1 页', async () => {
    const table = mountTable()
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    table.request.mockClear()

    // 走 sort prop：绕过 ProTable.onSort 自己置 1 的那条路径，单看 useTableRequest 的语义
    await table.wrapper.setProps({ sort: { key: 'name', order: 'desc' } })
    await flushPromises()

    expect(table.pages()).toEqual([1])
  })

  it('改排序从表格事件来（ProTable 已置 1）也只发一个请求', async () => {
    const table = mountTable()
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    table.request.mockClear()

    table.grid().vm.$emit('update:sort', { key: 'name', order: 'asc' })
    await flushPromises()

    expect(table.pages()).toEqual([1])
  })

  it('改 pageSize：回到第 1 页', async () => {
    const table = mountTable()
    await flushPromises()
    await table.nextPage()
    await flushPromises()
    table.request.mockClear()

    await table.wrapper.setProps({ pageSize: 50 })
    await flushPromises()

    expect(table.pages()).toEqual([1])
    expect(table.request.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 50 })
  })

  it('用户翻页就是要去那一页：不会被重置回第 1 页', async () => {
    const table = mountTable()
    await flushPromises()
    await table.nextPage()
    await flushPromises()

    expect(table.pages()).toEqual([1, 2])
    expect(table.rowIds()).toEqual([20, 21])
  })

  it('无限滚动下改筛选：回到第 1 页，只发一个请求且不拼接', async () => {
    const table = mountInfinite({ request: createFilterRequest() })
    await flushPromises()
    table.grid().vm.$emit('load-more')
    await flushPromises()
    expect(table.rowIds()).toEqual([10, 11, 20, 21])
    table.request.mockClear()

    await table.wrapper.setProps({ params: { keyword: 'k' } })
    await flushPromises()

    expect(table.pages()).toEqual([1])
    expect(table.rowIds()).toEqual([40, 41])
  })
})
