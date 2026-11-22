import { describe, expect, it, vi } from 'vitest'

/* 用 mock 截住 echarts 的 use()：导入全量 echarts 会让所有图型都已注册，
   那样无论默认集写几个都能通过 —— 测的就不是我们的默认集了。 */
const useSpy = vi.fn()
vi.mock('echarts/core', () => ({ use: (...args: unknown[]) => useSpy(...args) }))

import { registerFbkCharts } from '../src/register'

/**
 * 默认注册集必须覆盖公开类型承诺的全部图型。
 *
 * 以前默认只注册 line/bar/pie/gauge，而 FbkChartType 承诺 8 种、FbkChart 又是无参调用 ——
 * scatter 用户拿到「有坐标轴、没有系列、不显示空态」的空图表，emit(error) 也不触发。
 */
describe('registerFbkCharts 的默认集合', () => {
  it('默认注册的图型覆盖 CHART_MAP 的全部键（scatter / radar / funnel 不用显式注册）', () => {
    useSpy.mockClear()
    registerFbkCharts()
    /* register 内部是 use([...charts, ...components]) 一次调用，参数本身是数组，
       所以要拍平到底（flat() 一层只到「那个数组」）。 */
    const registered = useSpy.mock.calls.flat(Infinity) as unknown[]
    /* 注意：这一条 use() 的参数是 charts + components + renderer 混在一起的（16 个），
       只断言 >= 7 是假绿 —— 把 DEFAULT_CHARTS 退回 4 个（4+8+1=13）照样通过，
       而它正是为「图型被静默丢弃」写的守卫。
       现在的下界 = 7 个图型 + 8 个组件 + 1 个渲染器；少任何一个都会红。 */
    expect(
      registered.length,
      '默认注册集变少了（图型或组件被静默丢弃）',
    ).toBeGreaterThanOrEqual(16)
  })
})
