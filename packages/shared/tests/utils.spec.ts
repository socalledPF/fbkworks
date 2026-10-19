import { describe, expect, it } from 'vitest'
import { isNil, mergeUiProps, pickDefined, toCssSize } from '../src/utils'

describe('isNil', () => {
  it('只认 null / undefined', () => {
    expect(isNil(null)).toBe(true)
    expect(isNil(undefined)).toBe(true)
    expect(isNil(0)).toBe(false)
    expect(isNil('')).toBe(false)
    expect(isNil(false)).toBe(false)
  })
})

describe('toCssSize', () => {
  it('数字补 px', () => {
    expect(toCssSize(240)).toBe('240px')
  })

  it('字符串原样返回', () => {
    expect(toCssSize('50%')).toBe('50%')
    expect(toCssSize('10rem')).toBe('10rem')
  })

  it('空值返回 undefined，让 CSS 令牌回退生效', () => {
    expect(toCssSize(undefined)).toBeUndefined()
    expect(toCssSize(null as any)).toBeUndefined()
    expect(toCssSize('')).toBeUndefined()
  })

  it('0 是合法尺寸，不应被当成空值', () => {
    expect(toCssSize(0)).toBe('0px')
  })
})

describe('pickDefined', () => {
  it('剔除 undefined，保留 null / 0 / false / 空串', () => {
    expect(pickDefined({ a: 1, b: undefined, c: null, d: 0, e: false, f: '' })).toEqual({
      a: 1,
      c: null,
      d: 0,
      e: false,
      f: '',
    })
  })

  it('undefined 输入返回空对象', () => {
    expect(pickDefined(undefined)).toEqual({})
  })
})

describe('mergeUiProps', () => {
  it('优先级：base < normalized < uiProps', () => {
    const merged = mergeUiProps({ size: 'sm', color: 'red' }, { size: 'md' }, { color: 'blue' })
    expect(merged).toEqual({ size: 'md', color: 'blue' })
  })

  it('undefined 不覆盖已有值', () => {
    // 合并 uiProps 时最常见的坑：调用方写 { title: undefined } 把默认标题冲掉
    const merged = mergeUiProps({ title: '默认' }, {}, { title: undefined })
    expect(merged.title).toBe('默认')
  })

  it('deny 中的键强制回到 normalized', () => {
    const merged = mergeUiProps(undefined, { modelValue: 'internal' }, { modelValue: 'hacked' }, [
      'modelValue',
    ])
    expect(merged.modelValue).toBe('internal')
  })

  it('deny 中的键在 normalized 里不存在时被删除', () => {
    const merged = mergeUiProps(undefined, {}, { modelValue: 'hacked' }, ['modelValue'])
    expect('modelValue' in merged).toBe(false)
  })
})
