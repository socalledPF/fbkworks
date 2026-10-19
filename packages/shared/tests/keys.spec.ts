import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getRowKey, toKeySet } from '../src/keys'
import { resetWarnCache } from '../src/warn'

/**
 * 行 key 是选择态、v-for :key、勾选回填的唯一依据。
 * 一旦两行拿到同一个 key，勾一行会同时勾中另一行，DOM 也会被复用错乱。
 */
describe('getRowKey', () => {
  beforeEach(() => resetWarnCache())

  it('字符串 rowKey 取字段值', () => {
    expect(getRowKey({ id: 7, name: 'a' }, 0, 'id')).toBe(7)
    expect(getRowKey({ code: 'X1' }, 3, 'code')).toBe('X1')
  })

  it('函数 rowKey 用返回值', () => {
    expect(getRowKey({ a: 1, b: 2 }, 0, (row) => `${row.a}-${row.b}`)).toBe('1-2')
  })

  it('默认 rowKey 是 id', () => {
    expect(getRowKey({ id: 'k' }, 0)).toBe('k')
  })

  it('主键为 0 时保留 0，不回退到 index', () => {
    // 0 是完全合法的主键（自增从 0 起、枚举值 0），?? 判断必须只挡 null/undefined
    expect(getRowKey({ id: 0 }, 5, 'id')).toBe(0)
  })

  it('主键为空串时保留空串', () => {
    expect(getRowKey({ id: '' }, 5, 'id')).toBe('')
  })

  it('主键缺失时回退，且与合法主键不冲突', () => {
    // 这是本轮修复的核心：回退值必须落在独立命名空间里。
    // 旧实现回退到 index，导致 rows=[{}, {id:0}] 两行都拿到 key 0。
    const rows = [{}, { id: 0 }]
    const keys = rows.map((row, index) => getRowKey(row, index, 'id'))
    expect(new Set(keys).size).toBe(2)
  })

  it('混有缺失主键的行时，全部 key 互不相同', () => {
    const rows = [{ id: 1 }, {}, { id: 0 }, {}, { id: 3 }]
    const keys = rows.map((row, index) => getRowKey(row, index, 'id'))
    expect(new Set(keys).size).toBe(rows.length)
  })

  it('函数 rowKey 返回 undefined 时同样有兜底', () => {
    const keys = [getRowKey({}, 0, () => undefined as any), getRowKey({}, 1, () => undefined as any)]
    expect(new Set(keys).size).toBe(2)
    expect(keys.every((key) => key !== undefined)).toBe(true)
  })

  it('回退时只警告一次，不刷屏', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getRowKey({}, 0, 'id')
    getRowKey({}, 1, 'id')
    getRowKey({}, 2, 'id')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('toKeySet', () => {
  it('undefined 转空 Set', () => {
    expect(toKeySet(undefined).size).toBe(0)
  })

  it('保留元素并去重', () => {
    expect([...toKeySet([1, 1, 2])]).toEqual([1, 2])
  })
})
