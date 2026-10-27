import { describe, expect, it } from 'vitest'
import { vantAdapter } from '../src'

/**
 * 能力位与契约必须一致。
 *
 * `capabilities.feedback` 标 true 的含义是「这个适配器支持该能力」，
 * 而业务方探测到 true 之后能调的只有 `adapter.feedback` 上的 API。
 * 声明了却没有对应 API，等于承诺了一个调不到的方法。
 */
describe('vant 的 feedback 能力位与契约一致', () => {
  it('声明为 true 的每一项都在 adapter.feedback 上有对应 API', () => {
    const { feedback, capabilities } = vantAdapter
    const claimed = Object.entries(capabilities.feedback)
      .filter(([, supported]) => supported)
      .map(([key]) => key)

    expect(claimed.filter((key) => !(key in feedback))).toEqual([])
  })
})
