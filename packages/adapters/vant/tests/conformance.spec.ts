import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { runAdapterConformance } from '@fbk/adapter-conformance'
import { mountWithProvider } from '@fbk/test-utils'
import { vantAdapter } from '../src'

runAdapterConformance({
  adapter: vantAdapter,
  mount: (component, props) => mountWithProvider(component, { adapter: vantAdapter, props }),
  selectors: {
    row: '.fbk-vant-grid__card',
    selection: '.fbk-vant-grid__check',
    nextPage: '.van-pagination__item--next button',
    // 卡片列表自己渲染的 loading 条（van-loading），数据非空且 loading 时出现
    loading: '.fbk-vant-grid__loading',
  },
  /*
   * 排序：vant 不满足，显式声明而不是让 sort 用例无声地不存在。
   *
   * 卡片列表既没有表头也没有任何排序入口，全文没有一处 emit('update:sort')，
   * 因此 capabilities.dataGrid.sort 已改为 'none'（声明与实现对齐）。
   * 补齐需要先有产品决策（移动端排序是下拉、筛选栏还是顶栏菜单），
   * 在这之前用 skip 把它标成「本环境不满足的契约项」，而不是改实现硬凑一个入口。
   */
  skip: ['sort'],
})

/**
 * 卡片列表的 loading 反馈。
 *
 * 共享契约只在「data 非空 + loading」下断言标记存在 —— 那种情况本来就是
 * 列表上面盖一条 van-loading。真正会被用户看到的是首屏：data 还是空数组、
 * loading 已经 true，此时既没有 Empty 也没有 loading 条，整个列表区一片空白。
 */
describe('adapter: vant / 卡片列表 loading 态', () => {
  const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]

  const mountGrid = (props: Record<string, any> = {}) =>
    mountWithProvider(vantAdapter.primitives.DataGrid, {
      adapter: vantAdapter,
      props: { columns, data: [], rowKey: 'id', emptyText: '没有记录', ...props },
    })

  it('空数据 + loading 时仍有加载标记，且不同时喊「没有记录」', async () => {
    const wrapper = mountGrid({ data: [], loading: true })
    await flushPromises()

    expect(wrapper.find('.fbk-vant-grid__loading').exists(), '首次加载时列表区一片空白').toBe(true)
    expect(wrapper.text()).not.toContain('没有记录')
  })

  it('空数据 + 非 loading 时只有空态，没有加载标记', async () => {
    const wrapper = mountGrid({ data: [], loading: false })
    await flushPromises()

    expect(wrapper.find('.fbk-vant-grid__loading').exists()).toBe(false)
    expect(wrapper.text()).toContain('没有记录')
  })
})

/**
 * vant 专属：卡片列表是 FBK 自己渲染的 DOM，不是 vant 的组件，
 * 所以键盘可达性得自己兜。element-plus / naive-ui 的行由各自库渲染，改不动，
 * 不在共享契约套件里断言——放这里才不会让另外两个适配器无谓失败。
 */
describe('adapter: vant / 卡片列表键盘可达性', () => {
  const columns = [
    { key: 'name', title: '名称', dataIndex: 'name' },
    { key: 'age', title: '年龄', dataIndex: 'age' },
  ]
  const rows = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 24 },
  ]

  const mountGrid = (props: Record<string, any> = {}) =>
    mountWithProvider(vantAdapter.primitives.DataGrid, {
      adapter: vantAdapter,
      props: { columns, data: rows, rowKey: 'id', ...props },
    })

  it('rowClickable 时行可被 Tab 聚焦', async () => {
    const wrapper = mountGrid({ rowClickable: true })
    await flushPromises()
    expect(wrapper.find('.fbk-vant-grid__card').attributes('tabindex')).toBe('0')
  })

  it('不可点击的行不进入 Tab 序列', async () => {
    // 不然键盘用户要 Tab 过每一条只读记录才能走到下一个控件
    const wrapper = mountGrid({ rowClickable: false })
    await flushPromises()
    expect(wrapper.find('.fbk-vant-grid__card').attributes('tabindex')).toBeUndefined()
  })

  it('Enter 与空格都能触发行点击', async () => {
    const wrapper = mountGrid({ rowClickable: true })
    await flushPromises()
    const card = wrapper.find('.fbk-vant-grid__card')

    await card.trigger('keydown', { key: 'Enter' })
    await card.trigger('keydown', { key: ' ' })

    const emitted = wrapper.findComponent(vantAdapter.primitives.DataGrid).emitted('row-click')
    expect(emitted).toHaveLength(2)
    expect((emitted![0] as any[])[0]).toEqual(rows[0])
  })

  it('其他按键不触发', async () => {
    const wrapper = mountGrid({ rowClickable: true })
    await flushPromises()
    await wrapper.find('.fbk-vant-grid__card').trigger('keydown', { key: 'a' })
    expect(
      wrapper.findComponent(vantAdapter.primitives.DataGrid).emitted('row-click'),
    ).toBeUndefined()
  })
})
