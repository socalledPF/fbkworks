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

/**
 * 排序能力位必须与实现一致。
 *
 * 卡片列表既没有表头也没有任何排序入口，DataGrid 全文没有一处
 * emit('update:sort') —— 声明 'custom' 等于承诺一个发不出来的事件，
 * 业务方据此打开排序 UI 只会拿到一个永远不触发的回调。
 * 补齐移动端排序入口（下拉 / 筛选栏 / 顶栏菜单）需要产品方案，
 * 在此之前只声明 'none'。
 */
describe('vant 的排序能力位与实现一致', () => {
  it("dataGrid.sort 为 'none'（卡片列表没有排序入口）", () => {
    expect(vantAdapter.capabilities.dataGrid.sort).toBe('none')
  })
})
