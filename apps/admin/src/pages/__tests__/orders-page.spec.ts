// @vitest-environment jsdom
/**
 * 订单页的两条真实缺陷（在狗粮后台里暴露的，不是组件库的问题）：
 *
 *   1. 「新建订单」永远空白打开 —— 默认值写进了 initialValues，
 *      而 FormModal 在 create 模式只读 defaultValues。
 *   2. 删掉某页最后一条后停在空白页 —— refresh() 走 ProTable.reload() 且不带 resetPage。
 *
 * 运行方式（apps 不在根 vitest 的 include 里，用应用自己的 vite 配置：
 * 它通过 createWorkspaceAliases 把 @fbkworks/* 子路径指向源码）：
 *
 *   pnpm exec vitest run --config apps/admin/vite.config.ts src/pages/__tests__/orders-page.spec.ts
 */
import { flushPromises, mount } from '@vue/test-utils'
import {
  ADAPTER_CONTEXT,
  PERMISSION_CONTEXT,
  createAdapterContext,
  createPermissionDirective,
} from '@fbkworks/adapter-core'
import { createMockAdapter } from '@fbkworks/test-utils'
import type { PageQuery } from '@fbkworks/data'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrdersPage from '../OrdersPage.vue'
import type { OrderRow } from '../../mock/data'

/* 只替换三个数据访问函数，ORDER_STATUS_MAP 等继续用真实模块 ——
   测试要断言的正是「页面把默认值交给了哪个 prop」，与后端口径无关。 */
const state = vi.hoisted(() => ({
  rows: [] as OrderRow[],
  fetchOrders: vi.fn(),
  deleteOrders: vi.fn(),
}))

vi.mock('../../mock/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mock/data')>()
  return {
    ...actual,
    fetchOrders: (...args: unknown[]) => state.fetchOrders(...args),
    deleteOrders: (...args: unknown[]) => state.deleteOrders(...args),
    saveOrder: vi.fn(async (row: Partial<OrderRow>) => row),
  }
})

function makeRows(count: number): OrderRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    orderNo: `SO2026${String(index + 1).padStart(4, '0')}`,
    customer: `客户${index + 1}`,
    phone: '13800000000',
    channel: '直营',
    amount: 100 + index,
    status: 'pending',
    itemCount: 1,
    createdAt: '2026-01-01 10:00:00',
    paidAt: null,
    address: '上海市',
    remark: '',
  }))
}

const PERMISSIONS = ['order:delete']

function mountPage() {
  return mount(OrdersPage, {
    global: {
      provide: {
        [ADAPTER_CONTEXT as symbol]: createAdapterContext({ adapter: createMockAdapter() }),
        [PERMISSION_CONTEXT as symbol]: { getPermissions: () => PERMISSIONS },
      },
      directives: { permission: createPermissionDirective(() => PERMISSIONS) },
    },
  })
}

/** 请求链路是几层 await 串起来的，一拍不够 */
async function settle() {
  for (let i = 0; i < 4; i += 1) await flushPromises()
}

const pageOf = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.find('[data-fbk-part="pagination"]').attributes('data-page')

beforeEach(() => {
  // 21 条 = 2 页（pageSize 20）：第 2 页恰好只有 1 条，删掉它就空了
  state.rows = makeRows(21)
  state.fetchOrders.mockReset()
  state.deleteOrders.mockReset()
  state.fetchOrders.mockImplementation(async (query: PageQuery) => {
    const size = query.pageSize ?? 20
    const start = ((query.page ?? 1) - 1) * size
    return { list: state.rows.slice(start, start + size), total: state.rows.length }
  })
  state.deleteOrders.mockImplementation(async (ids: number[]) => {
    for (const id of ids) {
      const index = state.rows.findIndex((row) => row.id === id)
      if (index >= 0) state.rows.splice(index, 1)
    }
    return ids.length
  })
})

describe('订单页', () => {
  it('新建订单：表单带上默认状态与渠道', async () => {
    const wrapper = mountPage()
    await settle()

    await wrapper.findAll('button').find((button) => button.text() === '新建订单')!.trigger('click')
    await settle()

    const form = wrapper.findComponent({ name: 'FbkFormGenerator' })
    expect(form.props('modelValue')).toMatchObject({ status: 'pending', channel: '直营' })
  })

  it('删掉某页最后一条后回到上一页，而不是停在空白页', async () => {
    const wrapper = mountPage()
    await settle()
    expect(wrapper.findAll('[data-fbk-part="grid-row"]')).toHaveLength(20)

    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await settle()
    expect(pageOf(wrapper)).toBe('2')
    expect(wrapper.findAll('[data-fbk-part="grid-row"]')).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await wrapper.find('[data-action-key="delete"]').trigger('click')
    await settle()

    expect(state.fetchOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(pageOf(wrapper)).toBe('1')
    expect(wrapper.findAll('[data-fbk-part="grid-row"]')).toHaveLength(20)
  })
})
