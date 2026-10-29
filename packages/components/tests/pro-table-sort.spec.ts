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

  it('排序状态受控回流：DataGrid 收到当前排序', async () => {
    const request = vi.fn().mockResolvedValue({ list: gridRows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    const trigger = () => wrapper.find(sortTriggerSelector)
    await trigger().trigger('click')
    await flushPromises()
    expect(trigger().attributes('data-sort-order')).toBe('asc')
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
})
