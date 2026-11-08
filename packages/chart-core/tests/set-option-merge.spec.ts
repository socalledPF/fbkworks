import * as echarts from 'echarts'
import { describe, expect, it } from 'vitest'

/**
 * 为什么要有这条：`notMerge: false` 的坏处不是「配置没生效」，
 * 而是「旧的东西还在」—— 用 mock 断言看不出来，只有真让 echarts 渲染才看得见。
 * 这里用 echarts 的 SSR 渲染器（不需要 DOM），直接读 getOption() 的组件数量。
 */
const createChart = () =>
  echarts.init(null as any, null, { renderer: 'svg', ssr: true, width: 400, height: 300 })

const twoSeries = {
  legend: { show: true },
  xAxis: { type: 'category' as const, data: ['a', 'b'] },
  yAxis: { type: 'value' as const },
  series: [
    { type: 'line' as const, name: 'A', data: [1, 2] },
    { type: 'line' as const, name: 'B', data: [3, 4] },
  ],
}

describe('setOption 的合并策略', () => {
  it('纯合并不行：系列变少后旧系列仍然在（这就是缺陷本身）', () => {
    const chart = createChart()
    chart.setOption(twoSeries as any)
    chart.setOption(
      {
        series: [{ type: 'line', name: 'A', data: [9, 9] }],
      } as any,
      { notMerge: false },
    )
    expect((chart.getOption() as any).series.length).toBe(2)
    chart.dispose()
  })

  it('replaceMerge 会移除多余系列，并在新配置没有 legend 时移除图例', () => {
    const chart = createChart()
    chart.setOption(twoSeries as any)
    chart.setOption(
      {
        series: [{ type: 'line', name: 'A', data: [9, 9] }],
      } as any,
      { replaceMerge: ['series', 'legend'] },
    )
    const option = chart.getOption() as any
    expect(option.series.length).toBe(1)
    expect(option.series[0].data).toEqual([9, 9])
    // 合并语义下「没给 legend」= 别动；replaceMerge 下才会真的消失
    expect(option.legend?.length ?? 0).toBe(0)
    chart.dispose()
  })
})
