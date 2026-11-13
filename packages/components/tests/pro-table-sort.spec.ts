import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMockAdapter, mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'

/**
 * mock 适配器的排序能力，以及 ProTable 之上的排序链路。
 *
 * 背景：mock 的 capabilities 声明 `dataGrid.sort: 'custom'`，但一开始全文
 * 没有一处 emit('update:sort') —— 声明与实现脱节。后果是 ProTable.onSort
 * （含「排序后强制回第 1 页」这条业务规则）在组件测试里一次也执行不到。
 *
 * 第一组用例钉住原语本身（契约语义），第二组用例验证组件链路。
 */

const sortColumns = [
  { key: 'userName', title: '名称', dataIndex: 'name', sortable: true },
  { key: 'userAge', title: '年龄', dataIndex: 'age', sortable: true },
  // 不可排序的列不该出现排序控件
  { key: 'remark', title: '备注' },
]

const gridRows = [
  { id: 1, name: 'Alice', age: 30, remark: 'x' },
  { id: 2, name: 'Bob', age: 24, remark: 'y' },
]

const sortTriggerSelector = '[data-fbk-part="sort-trigger"]'

function mountGrid(adapter = createMockAdapter(), columns: any[] = sortColumns) {
  return mount(adapter.primitives.DataGrid, {
    props: { columns, data: gridRows, rowKey: 'id' },
  })
}

/** 取最后一次 update:sort 的 payload */
function lastSort(wrapper: ReturnType<typeof mountGrid>): any {
  return wrapper.findComponent({ name: 'MockDataGrid' }).emitted('update:sort')?.at(-1)?.[0]
}

describe('mock 适配器的 DataGrid 排序契约', () => {
  it('capabilities 声明可排序，且确实渲染出可点的排序控件', async () => {
    const adapter = createMockAdapter()
    expect(adapter.capabilities.dataGrid.sort).toBe('custom')

    const wrapper = mountGrid(adapter)
    await flushPromises()
    // 两列 sortable → 恰好两个排序控件；不可排序的列没有
    expect(wrapper.findAll(sortTriggerSelector)).toHaveLength(2)
  })

  it('点击排序控件发出 { field, order }，field 取 column.dataIndex', async () => {
    const wrapper = mountGrid()
    await flushPromises()

    await wrapper.findAll(sortTriggerSelector)[0].trigger('click')
    await flushPromises()

    const first = lastSort(wrapper)
    expect(Object.keys(first ?? {}).sort()).toEqual(['field', 'order'])
    expect(first.field).toBe('name')
    // mock 与 element-plus 对齐：首次点击是升序
    expect(first.order).toBe('asc')
  })

  it('同一列连点三态循环：asc → desc → null', async () => {
    const wrapper = mountGrid()
    await flushPromises()
    const trigger = wrapper.findAll(sortTriggerSelector)[0]

    await trigger.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toEqual({ field: 'name', order: 'asc' })

    await trigger.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toEqual({ field: 'name', order: 'desc' })

    // 第三次撤销排序：payload 整体为 null，业务侧才清得掉查询条件
    await trigger.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toBeNull()

    // 继续点回到升序，而不是停在 null
    await trigger.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toEqual({ field: 'name', order: 'asc' })
  })

  it('换一列时 field 跟着列走，且不会继承上一个方向', async () => {
    const wrapper = mountGrid()
    await flushPromises()
    const [first, second] = wrapper.findAll(sortTriggerSelector)

    await first.trigger('click')
    await first.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toEqual({ field: 'name', order: 'desc' })

    await second.trigger('click')
    await flushPromises()
    expect(lastSort(wrapper)).toEqual({ field: 'age', order: 'asc' })
  })

  it('dataIndex 缺省时 field 回退到 column.key', async () => {
    const wrapper = mountGrid(createMockAdapter(), [
      { key: 'userName', title: '名称', sortable: true },
    ])
    await flushPromises()

    const triggers = wrapper.findAll(sortTriggerSelector)
    expect(triggers).toHaveLength(1)
    await triggers[0].trigger('click')
    await flushPromises()

    expect(lastSort(wrapper)?.field).toBe('userName')
  })
})

describe('FbkProTable 排序链路', () => {
  const columns = [{ key: 'userName', title: '名称', dataIndex: 'name', sortable: true }]

  it('点击可排序列发出 update:sort 并带上新排序请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: gridRows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    const trigger = wrapper.find(sortTriggerSelector)
    expect(trigger.exists(), 'mock 的 DataGrid 必须渲染可点的排序控件').toBe(true)
    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:sort')?.at(-1)).toEqual([{ field: 'name', order: 'asc' }])
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: { field: 'name', order: 'asc' } }),
    )
  })

  it('连续点表头循环 asc → desc，每次都 emit update:sort 并带着它重新请求', async () => {
    /* 这条以前断言的是 `data-sort-order` —— 那是 **mock 适配器自己的内部状态**，
       把 ProTable 的 onSort 整体删掉它照样绿（标题却写着「DataGrid 收到当前排序」）。
       现在断言的是 ProTable 的产出：事件载荷 + 请求参数。 */
    const request = vi.fn().mockResolvedValue({ list: gridRows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    const trigger = () => wrapper.find(sortTriggerSelector)
    await trigger().trigger('click')
    await flushPromises()
    await trigger().trigger('click')
    await flushPromises()

    const emitted = wrapper.findComponent(FbkProTable).emitted('update:sort') ?? []
    expect(emitted.map((args) => (args[0] as any)?.order)).toEqual(['asc', 'desc'])
    expect(request.mock.calls.at(-1)?.[0].sort).toEqual({ field: 'name', order: 'desc' })
  })

  it('改每页条数：emit update:pageSize，并把页码拉回第 1 页（同时 emit update:page）', async () => {
    /* 这条路径以前**一次都没被执行过**：mock 的分页器只渲染上下页，
       从不发 update:pageSize；`setProps({ pageSize })` 走的是 prop → watch 那条路，
       绕过了 ProTable 自己的 onPageSize。

       注意它锁的是**结果**（改条数后落在第 1 页），而这个结果当前有两条实现路径：
       onPageSize 自己调 onPage(1)，以及 useTableRequest 的 watcher 在「条数变化」时 setPage(1)。
       拆掉其中任意一条都不会红（实测），两条都拆才红 —— 这正是「锁行为不锁实现」。 */
    const adapter = createMockAdapter()
    const request = vi.fn().mockResolvedValue({ list: gridRows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      adapter,
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    // 先翻到第 2 页，这样「回第 1 页」才有可观察的变化
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()
    expect(request.mock.calls.at(-1)?.[0].page).toBe(2)

    /* findComponent 返回的是 VueWrapper（有 .vm）；写成 find 会拿到 DOMWrapper。
       断言里用 as any 只是为了让 $emit 这个测试专用入口通过类型检查。 */
    const pagination = wrapper.findComponent(adapter.primitives.Pagination as any) as any
    pagination.vm.$emit('update:pageSize', 50)
    await flushPromises()

    const vm = wrapper.findComponent(FbkProTable)
    expect(vm.emitted('update:pageSize')?.at(-1)).toEqual([50])
    expect(vm.emitted('update:page')?.at(-1), '改条数没有把页码拉回第 1 页').toEqual([1])
    expect(request.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 50 })
  })

  it('在第 2 页点排序 → 请求回到第 1 页，且 sort 正确', async () => {
    const request = vi.fn().mockResolvedValue({ list: gridRows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    const trigger = wrapper.find(sortTriggerSelector)
    expect(trigger.exists(), 'mock 的 DataGrid 必须渲染可点的排序控件').toBe(true)
    await trigger.trigger('click')
    await flushPromises()

    // 停在第 2 页查一个刚换过排序的列表，用户会看到「这一页没数据」；规则是回第 1 页
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: { field: 'name', order: 'asc' } }),
    )
    // 回第 1 页与改排序是同一次查询：首次 1 次 + 翻页 1 次 + 排序 1 次
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('排序把页码改回 1 时必须 emit update:page —— page 是受控的', async () => {
    /* 以前 onSort 直接写 innerPage.value = 1，不发事件：
       父级拿 v-model:page 同步 URL 时，地址栏还停在第 2 页，而真实请求已经是第 1 页。 */
    const request = vi.fn(async ({ page }: any) => ({ list: [{ id: page }], total: 5 }))
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, pagination: { pageSize: 1, total: 5 } },
    })
    await flushPromises()

    // 先翻到第 2 页：这样「排序把页码改回 1」才有可观察的变化
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()
    expect(request.mock.calls.at(-1)?.[0].page).toBe(2)

    await wrapper.findAll(sortTriggerSelector)[0].trigger('click')
    await flushPromises()

    const emitted = wrapper.findComponent(FbkProTable).emitted('update:page') ?? []
    expect(emitted.at(-1), '排序回第一页没有 emit update:page').toEqual([1])
    expect(request.mock.calls.at(-1)?.[0].page).toBe(1)
  })
})
