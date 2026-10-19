import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { resolveColumnRenderer } from '../src/pro-table/value-renderer'
import type { ProTableColumn } from '../src/pro-table/types'

const Tag = { name: 'Tag', render: () => null }

const resolve = (column: ProTableColumn) =>
  resolveColumnRenderer(column, { Tag: Tag as any })

/**
 * numeric 标记决定适配器是否给单元格加等宽数字（tabular-nums）。
 * 它由 valueType 推导，用户显式写 numeric 时以用户为准。
 */
describe('resolveColumnRenderer 的 numeric 标记', () => {
  it('money / number 列自动标记为数值列', () => {
    expect(resolve({ key: 'a', title: 'A', valueType: 'money' }).numeric).toBe(true)
    expect(resolve({ key: 'b', title: 'B', valueType: 'number' }).numeric).toBe(true)
  })

  it('非数值列不标记', () => {
    // 实现给出 false 而非 undefined；适配器按真值判断，两者等价。
    expect(resolve({ key: 'c', title: 'C', valueType: 'text' }).numeric).toBeFalsy()
    expect(resolve({ key: 'd', title: 'D', valueType: 'date' }).numeric).toBeFalsy()
  })

  it('用户显式写的 numeric 优先于 valueType 推导', () => {
    expect(resolve({ key: 'e', title: 'E', valueType: 'money', numeric: false }).numeric).toBe(false)
    expect(resolve({ key: 'f', title: 'F', valueType: 'text', numeric: true }).numeric).toBe(true)
  })

  it('自定义 render 的列原样返回，不注入 numeric', () => {
    const render = () => 'x'
    const column = resolve({ key: 'g', title: 'G', valueType: 'money', render })
    expect(column.numeric).toBeUndefined()
    // 没有 copyable/tooltip 时连 render 都不重新包一层，引用保持不变
    expect(column.render).toBe(render)
  })
})

/**
 * copyable / tooltip 原先只在类型里声明、没有任何实现：
 * 业务侧写了 `copyable: true` 不报错也不生效，属于最难排查的一类缺陷。
 */
describe('resolveColumnRenderer 的展示外壳', () => {
  const row = { id: 1, orderNo: 'SO20260001', amount: 1234.5 }

  const renderInCell = (column: ProTableColumn, data: Record<string, any> = row) =>
    mount(
      defineComponent({
        setup: () => () => {
          const value = data[(column.dataIndex ?? column.key) as string]
          return h('div', [column.render?.({ row: data, index: 0, column, value }) as any])
        },
      }),
    )

  it('没写外壳的列不包任何额外节点', () => {
    const column = resolve({ key: 'a', title: 'A', dataIndex: 'orderNo', valueType: 'text' })
    const wrapper = renderInCell(column)
    expect(wrapper.find('.fbk-pro-table__copyable').exists()).toBe(false)
    expect(wrapper.find('.fbk-pro-table__tip').exists()).toBe(false)
  })

  it('copyable 渲染复制按钮，并带上原始值', () => {
    const column = resolve({
      key: 'orderNo',
      title: '订单号',
      dataIndex: 'orderNo',
      valueType: 'text',
      copyable: true,
    })
    const wrapper = renderInCell(column)

    const button = wrapper.find('.fbk-pro-table__copy')
    expect(button.exists()).toBe(true)
    expect(button.attributes('data-copy-text')).toBe('SO20260001')
    expect(button.attributes('aria-label')).toBe('复制订单号')
  })

  it('复制按钮不冒泡成行点击', async () => {
    const column = resolve({
      key: 'orderNo',
      title: '订单号',
      dataIndex: 'orderNo',
      valueType: 'text',
      copyable: true,
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const onRowClick = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', { onClick: onRowClick }, [
            column.render!({ row, index: 0, column, value: row.orderNo }) as any,
          ]),
      }),
    )

    await wrapper.find('.fbk-pro-table__copy').trigger('click')
    expect(writeText).toHaveBeenCalledWith('SO20260001')
    // 行本身可点击，复制不能顺带把行打开
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('空值不渲染复制按钮', () => {
    const column = resolve({
      key: 'orderNo',
      title: '订单号',
      dataIndex: 'orderNo',
      valueType: 'text',
      copyable: true,
    })
    const wrapper = renderInCell(column, { orderNo: null })
    expect(wrapper.find('.fbk-pro-table__copy').exists()).toBe(false)
  })

  it('tooltip 落在 title 属性上', () => {
    const column = resolve({
      key: 'amount',
      title: '金额',
      dataIndex: 'amount',
      valueType: 'money',
      tooltip: '含税金额',
    })
    const wrapper = renderInCell(column)
    expect(wrapper.find('.fbk-pro-table__tip').attributes('title')).toBe('含税金额')
  })

  it('tooltip 在外、copyable 在内', () => {
    const column = resolve({
      key: 'orderNo',
      title: '订单号',
      dataIndex: 'orderNo',
      valueType: 'text',
      copyable: true,
      tooltip: '业务单号',
    })
    const wrapper = renderInCell(column)
    const tip = wrapper.find('.fbk-pro-table__tip')
    // wrapper.html() 会把模板编译成片段，直接断外层元素更稳
    expect((tip.element as HTMLElement).querySelector('.fbk-pro-table__copyable')).not.toBeNull()
  })

  it('用户自定义 render 也能挂上外壳', () => {
    const column = resolve({
      key: 'orderNo',
      title: '订单号',
      dataIndex: 'orderNo',
      render: ({ value }) => `#${value}`,
      copyable: true,
    })
    const wrapper = renderInCell(column)
    expect(wrapper.text()).toContain('#SO20260001')
    expect(wrapper.find('.fbk-pro-table__copy').attributes('data-copy-text')).toBe('SO20260001')
  })
})
