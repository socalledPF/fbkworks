import { describe, expect, it } from 'vitest'
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
    expect(column.render).toBe(render)
  })
})
