import { describe, expect, it } from 'vitest'
import { FbkDataError } from '../src/error'
import { extractRows, extractTotal, getByPath } from '../src/path'

/**
 * 路径解析。
 *
 * 这块的关键取舍：**解析失败必须抛错，不能返回 undefined**。
 * 返回 undefined 会让列表变成空数组，用户看到「暂无数据」，
 * 而真实原因是字段名写错 —— 这类 bug 排查成本极高。
 */

describe('getByPath', () => {
  it('取单层字段', () => {
    expect(getByPath({ rows: [1, 2] }, 'rows')).toEqual([1, 2])
  })

  it('取多层嵌套', () => {
    expect(getByPath({ data: { records: [1] } }, 'data.records')).toEqual([1])
  })

  it('支持数组下标（真实后端有这种结构）', () => {
    expect(getByPath({ data: { list: [{ items: ['a'] }] } }, 'data.list.0.items')).toEqual(['a'])
  })

  it('空路径返回原值', () => {
    const raw = { a: 1 }
    expect(getByPath(raw, '')).toBe(raw)
  })

  it('字段名写错时抛错，且消息里带实际响应', () => {
    const raw = { rows: [1], total: 1 }
    expect(() => getByPath(raw, 'records')).toThrow(FbkDataError)
    try {
      getByPath(raw, 'records')
    } catch (e) {
      expect((e as FbkDataError).kind).toBe('path')
      // 关键：必须能看到实际响应，否则要重新抓包
      expect((e as Error).message).toContain('rows')
    }
  })

  it('中间层为 null 时抛错而不是静默', () => {
    expect(() => getByPath({ data: null }, 'data.records')).toThrow(FbkDataError)
  })

  it('从原始类型上取属性时抛错', () => {
    expect(() => getByPath({ data: 'string' }, 'data.records')).toThrow(FbkDataError)
  })

  it('数组下标越界时抛错', () => {
    expect(() => getByPath({ list: [] }, 'list.0')).toThrow(FbkDataError)
  })
})

describe('extractRows', () => {
  it('从路径取数组', () => {
    expect(extractRows({ rows: [1, 2] }, 'rows')).toEqual([1, 2])
  })

  it('支持函数形式', () => {
    expect(extractRows({ d: { x: [3] } }, (raw: any) => raw.d.x)).toEqual([3])
  })

  it('取到的不是数组时抛错', () => {
    expect(() => extractRows({ rows: 'not-array' }, 'rows')).toThrow(FbkDataError)
  })

  it('空数组是合法的（不能当成错误）', () => {
    expect(extractRows({ rows: [] }, 'rows')).toEqual([])
  })
})

describe('extractTotal', () => {
  it('取数字总数', () => {
    expect(extractTotal({ total: 42 }, 'total')).toBe(42)
  })

  it('字符串数字自动转换（后端常返回字符串）', () => {
    expect(extractTotal({ total: '128' }, 'total')).toBe(128)
  })

  it('非数字时抛错', () => {
    expect(() => extractTotal({ total: 'abc' }, 'total')).toThrow(FbkDataError)
  })
})
