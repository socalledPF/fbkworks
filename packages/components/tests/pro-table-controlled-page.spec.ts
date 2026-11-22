import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'

const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
const rows = [{ id: 1, name: 'Alice' }]

/**
 * 受控页码的「入」这一半（v-model:page）。
 *
 * 外部把新的 page 传进来，ProTable 必须把它同步到内部页码并重发该页请求
 * （src/pro-table/ProTable.vue:59 → use-table-request 的 page watch）。
 * 订单页「删掉本页最后一条后回退上一页」依赖的就是这条：
 * 页面自己算出目标页写回 page，表格跟着重查。
 *
 * 注意边界：**什么时候该回退（剩 0 行）是应用侧判断**，不在库的职责里，
 * 这条用例只锁「page 变 → 请求跟着变」。
 */
describe('FbkProTable 受控 page', () => {
  it('外部改 page 后同步内部页码并重发该页请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 100 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id', page: 1 },
    })
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))

    await wrapper.setProps({ page: 2 })
    await flushPromises()

    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    expect(wrapper.find('[data-fbk-part="pagination"]').attributes('data-page')).toBe('2')
  })
})
