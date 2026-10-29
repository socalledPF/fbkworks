import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMockAdapter, mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'

const columns = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money' as const },
]

const rows = [
  { id: 1, name: 'Alice', amount: 1234.5 },
  { id: 2, name: 'Bob', amount: 20 },
]

describe('FbkProTable', () => {
  it('用 request 拉取数据并传递分页参数', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, sort: null }),
    )
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.find('[data-fbk-part="data-grid"]').exists()).toBe(true)
  })

  it('受控 data 模式下不调用 request', async () => {
    const request = vi.fn()
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, request, rowKey: 'id' },
    })
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bob')
  })

  it('金额列按 valueType 格式化', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('1,234.50')
  })

  it('适配器不支持选择时不渲染选择列', async () => {
    const adapter = createMockAdapter({ dataGrid: { selection: false } })
    const wrapper = mountWithAdapter(FbkProTable, {
      adapter,
      props: { columns, data: rows, rowKey: 'id', selection: {} },
    })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="selection"]').exists()).toBe(false)
  })

  it('翻页触发 update:page 并带上新页码请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:page')?.at(-1)).toEqual([2])
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('请求竞态：旧响应不会覆盖新数据', async () => {
    let resolveFirst: (value: any) => void = () => {}
    const request = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ list: [{ id: 9, name: 'New' }], total: 1 })

    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    // 触发第二次请求
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()

    // 第一次请求现在才返回，应当被丢弃
    resolveFirst({ list: [{ id: 1, name: 'Stale' }], total: 1 })
    await flushPromises()

    expect(wrapper.text()).toContain('New')
    expect(wrapper.text()).not.toContain('Stale')
  })

  it('request 抛错时触发 error 事件', async () => {
    const error = new Error('boom')
    const request = vi.fn().mockRejectedValue(error)
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.emitted('error')?.[0]?.[0]).toBe(error)
  })

  it('reload({ resetPage }) 回到第一页', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()

    const table = wrapper.findComponent(FbkProTable)
    await (table.vm as any).reload({ resetPage: true })
    await flushPromises()

    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })

  /**
   * selection 的配置项原先只在类型里，组件从不读它们。
   * 业务侧写 selection: { columnWidth: 60 } 与实际渲染的列宽无关。
   */
  it('selection.columnWidth 传给 DataGrid', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id', selection: { columnWidth: 60 } },
    })
    await flushPromises()
    expect(
      wrapper.find('[data-fbk-part="data-grid"]').attributes('data-selection-width'),
    ).toBe('60')
  })

  it('selection 未配置列宽时用 48 的默认值', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id', selection: {} },
    })
    await flushPromises()
    expect(
      wrapper.find('[data-fbk-part="data-grid"]').attributes('data-selection-width'),
    ).toBe('48')
  })

  it('preserveOnReload 默认保留已选行', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id', selection: {} },
    })
    await flushPromises()

    const table = wrapper.findComponent(FbkProTable)
    const grid = () => wrapper.findComponent({ name: 'MockDataGrid' })
    ;(table.vm as any).setSelectedKeys([1])
    await flushPromises()

    await (table.vm as any).reload()
    await flushPromises()

    // 默认不清选择：翻页/刷新后勾选仍然保留
    expect(grid().props('selectedKeys')).toEqual([1])
  })

  it('preserveOnReload: false 时 reload 清空选择', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id', selection: { preserveOnReload: false } },
    })
    await flushPromises()

    const table = wrapper.findComponent(FbkProTable)
    const grid = () => wrapper.findComponent({ name: 'MockDataGrid' })
    ;(table.vm as any).setSelectedKeys([1])
    await flushPromises()
    expect(grid().props('selectedKeys')).toEqual([1])

    await (table.vm as any).reload()
    await flushPromises()

    expect(grid().props('selectedKeys')).toEqual([])
  })
})

/**
 * 请求失败必须有可见呈现。
 *
 * use-table-request 早就把 error 存进 ref 并 emit 了，但组件从不读它 ——
 * reject 后 data 仍是 []，DataGrid 老老实实渲染 emptyText「暂无数据」：
 * 用户读到的结论是「没有数据」，实际是「加载失败」。
 */
describe('FbkProTable 请求失败的错误态', () => {
  it('reject 时显示错误态，不再显示「暂无数据」', async () => {
    const request = vi.fn().mockRejectedValue(new Error('network down'))
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    expect(wrapper.find('[data-fbk-part="empty"]').exists(), '失败仍在渲染空态').toBe(false)
    expect(wrapper.find('[data-fbk-part="data-grid"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('network down')
  })

  it('错误态可重试，重试成功后回到正常表格', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ list: rows, total: 2 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    await wrapper.find('.fbk-pro-table__retry').trigger('click')
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.fbk-result').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alice')
  })

  it('error 插槽可整体定制，并拿到 error 与 retry', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ list: rows, total: 2 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
      slots: {
        error: (slotProps: any) =>
          h('div', { 'data-test': 'custom-error' }, [
            (slotProps.error as Error).message,
            h('button', { 'data-test': 'custom-retry', onClick: slotProps.retry }, '再来一次'),
          ]),
      },
    })
    await flushPromises()

    expect(wrapper.find('.fbk-result').exists(), '传了插槽仍渲染默认错误态').toBe(false)
    expect(wrapper.find('[data-test="custom-error"]').text()).toContain('boom')

    await wrapper.find('[data-test="custom-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Alice')
  })

  it('请求成功不显示错误态', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 2 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    expect(wrapper.find('.fbk-result').exists()).toBe(false)
    expect(wrapper.find('[data-fbk-part="data-grid"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
  })

  it('请求成功但列表为空时仍是「暂无数据」，不是错误态', async () => {
    const request = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    expect(wrapper.find('.fbk-result').exists(), '空数据被误判成错误').toBe(false)
    expect(wrapper.find('[data-fbk-part="empty"]').text()).toContain('暂无数据')
  })
})
