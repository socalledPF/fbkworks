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
  },
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
