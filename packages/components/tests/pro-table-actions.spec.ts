import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'
import type { ProTableColumn, ProTableAction } from '../src/pro-table/types'

const columns: ProTableColumn[] = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money' },
]
const rows = [
  { id: 1, name: 'Alice', amount: 100 },
  { id: 2, name: 'Bob', amount: 200 },
]

describe('操作栏（actions 列）', () => {
  it('actions 列按 action 定义渲染按钮', async () => {
    const actions: ProTableAction[] = [
      { key: 'edit', text: '编辑' },
      { key: 'delete', text: '删除', status: 'danger' },
    ]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions }], data: rows, rowKey: 'id' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('编辑')
    expect(wrapper.text()).toContain('删除')
  })

  it('点击 action 时带出 row 与 index', async () => {
    const onClick = vi.fn()
    const actions: ProTableAction[] = [{ key: 'edit', text: '编辑', onClick }]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions }], data: rows, rowKey: 'id' },
    })
    await flushPromises()

    const buttons = wrapper.findAll('.fbk-pro-table__action')
    expect(buttons.length).toBe(2)
    await buttons[1].trigger('click')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick.mock.calls[0][0]).toEqual(expect.objectContaining({ row: rows[1], index: 1 }))
  })

  it('点击 action 不冒泡成 row-click', async () => {
    const onClick = vi.fn()
    const actions: ProTableAction[] = [{ key: 'edit', text: '编辑', onClick }]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions }], data: rows, rowKey: 'id' },
    })
    await flushPromises()

    await wrapper.find('.fbk-pro-table__action').trigger('click')
    expect(wrapper.emitted('row-click')).toBeUndefined()
  })

  it('action 的 visible 按行求值', async () => {
    const actions: ProTableAction[] = [
      { key: 'del', text: '删除', visible: ({ row }) => row.id === 2 },
    ]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions }], data: rows, rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.findAll('.fbk-pro-table__action').length).toBe(1)
  })

  it('action 的 disabled 按行求值', async () => {
    const actions: ProTableAction[] = [
      { key: 'edit', text: '编辑', disabled: ({ row }) => row.id === 1 },
    ]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions }], data: rows, rowKey: 'id' },
    })
    await flushPromises()
    const buttons = wrapper.findAll('.fbk-pro-table__action')
    expect(buttons[0].attributes('disabled')).toBeDefined()
    expect(buttons[1].attributes('disabled')).toBeUndefined()
  })

  it('超过 max 个 action 时折叠成「更多」', async () => {
    const actions: ProTableAction[] = [
      { key: 'a', text: '查看' },
      { key: 'b', text: '编辑' },
      { key: 'c', text: '复制' },
      { key: 'd', text: '删除' },
    ]
    const wrapper = mountWithAdapter(FbkProTable, {
      props: {
        columns: [...columns, { key: 'op', title: '操作', valueType: 'actions', actions, max: 2 }],
        data: rows,
        rowKey: 'id',
      },
    })
    await flushPromises()

    // 两行数据，每行一组按钮；直接可见的只有前 2 个
    const groups = wrapper.findAll('.fbk-pro-table__actions')
    expect(groups.length).toBe(2)
    for (const group of groups) {
      const direct = group.findAll(':scope > .fbk-pro-table__action')
      expect(direct.map((b) => b.text())).toEqual(['查看', '编辑'])
    }

    // 其余在 <details> 里
    const more = wrapper.findAll('.fbk-pro-table__actions-more')
    expect(more.length).toBe(2)
    expect(more[0].text()).toContain('更多')
    expect(more[0].text()).toContain('复制')
    expect(more[0].text()).toContain('删除')
  })

  it('columns 级 actions 可被子列覆盖', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: {
        columns: [
          ...columns,
          {
            key: 'op',
            title: '操作',
            valueType: 'actions',
            actions: [{ key: 'x', text: '列内' }],
          },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('列内')
  })
})

describe('selection 补全', () => {
  it('表头全选勾选当前页全部行', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id', selection: {} },
    })
    await flushPromises()

    const all = wrapper.find('.fbk-pro-table__select-all input')
    expect(all.exists()).toBe(true)
    await all.setValue(true)

    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([1, 2])
  })

  it('全选在部分选中时是 indeterminate', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id', selection: {}, selectedKeys: [1] },
    })
    await flushPromises()

    const all = wrapper.find('.fbk-pro-table__select-all input')
    expect((all.element as HTMLInputElement).indeterminate).toBe(true)
  })

  it('已全选时再次点击取消全部', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, data: rows, rowKey: 'id', selection: {}, selectedKeys: [1, 2] },
    })
    await flushPromises()

    const all = wrapper.find('.fbk-pro-table__select-all input')
    await all.setValue(false)
    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([])
  })
})
