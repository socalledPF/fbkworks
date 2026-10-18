import { describe, expect, it } from 'vitest'
import { resolveColumns } from '../src/responsive'

/**
 * 这组测试守的是「响应式列数不再静默失效」。
 *
 * 旧实现返回 `@container (min-width: 640px) 2 | ...` 这样的字符串，
 * 没有任何样式表消费它，于是对象形式全部无效且不报错。
 * 现在输出的是 CSS 变量，测试锁定变量名与「只写差异」的语义。
 */
describe('resolveColumns', () => {
  it('数字形式写 --fbk-cols-base', () => {
    expect(resolveColumns(3)).toEqual({ '--fbk-cols-base': '3' })
  })

  it('未传时返回空对象，让样式表回退到组件令牌默认值', () => {
    expect(resolveColumns(undefined)).toEqual({})
  })

  it('对象形式逐断点写变量', () => {
    expect(resolveColumns({ xs: 1, sm: 2, md: 3, lg: 4 })).toEqual({
      '--fbk-cols-xs': '1',
      '--fbk-cols-sm': '2',
      '--fbk-cols-md': '3',
      '--fbk-cols-lg': '4',
    })
  })

  it('缺省的断点不写变量，交给 var() 回退链继承更小的断点', () => {
    expect(resolveColumns({ xs: 1, md: 3 })).toEqual({
      '--fbk-cols-xs': '1',
      '--fbk-cols-md': '3',
    })
  })

  it('空对象不产生任何变量', () => {
    expect(resolveColumns({})).toEqual({})
  })
})
