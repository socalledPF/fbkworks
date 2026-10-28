import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProvider } from '@fbk/test-utils'
import type { UiAdapter } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import { naiveUiAdapter } from '@fbk/adapter-naive-ui'

/**
 * A8 现状对照（待产品决策）。
 *
 * 契约里 DataGridColumn.dataIndex 是可选的，update:sort 也只规定了 payload 形状
 * { field, order }，没规定 field 取自 column.key 还是 column.dataIndex。
 * 实测两边取了不同的一方：key ≠ dataIndex 时 element-plus 给 dataIndex、
 * naive-ui 给 column.key。共享套件的 sort 用例因此只用 key === dataIndex 的列
 * （断言两者共同的真相，不写成「field 是任意字符串」）；差异本身钉在这里，
 * A8 收敛成单一语义后本文件整体删除，并把共享用例的列换成 key ≠ dataIndex。
 */
describe('A8：key ≠ dataIndex 时 update:sort 的 field 来源', () => {
  const columns = [{ key: 'userName', title: '名称', dataIndex: 'name', sortable: true }]
  const data = [{ id: 1, name: 'Alice' }]

  const fieldOf = async (adapter: UiAdapter, sortTrigger: string) => {
    const wrapper = mountWithProvider(adapter.primitives.DataGrid, {
      adapter,
      props: { columns, data, rowKey: 'id' },
    })
    await flushPromises()
    await wrapper.find(sortTrigger).trigger('click')
    await flushPromises()
    const payload = wrapper.findComponent(adapter.primitives.DataGrid).emitted('update:sort')?.at(-1)?.[0]
    return (payload as { field?: string } | null)?.field
  }

  it('element-plus 回传 dataIndex，naive-ui 回传 key', async () => {
    expect(await fieldOf(elementPlusAdapter, '.caret-wrapper')).toBe('name')
    expect(await fieldOf(naiveUiAdapter, '.n-data-table-sorter')).toBe('userName')
  })
})
