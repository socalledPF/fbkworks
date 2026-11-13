import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * FbkChart 的组件行为。
 *
 * jsdom 没有 Canvas 实现，ECharts 无法真实绘制，所以这里 mock 掉
 * `echarts/core` 的 init，只验证**我们的编排逻辑**：
 *   · 何时 init、何时 dispose
 *   · setOption 的参数是否经过 CSS 变量解析
 *   · 空态时是否跳过渲染
 *   · 卸载时是否清理
 *
 * 真实绘制由浏览器实测覆盖（见设计文档的验收记录）。
 */

const instances: Array<Record<string, any>> = []

vi.mock('echarts/core', () => {
  return {
    init: vi.fn(() => {
      const instance = {
        setOption: vi.fn(),
        resize: vi.fn(),
        dispose: vi.fn(),
        on: vi.fn(),
        showLoading: vi.fn(),
        hideLoading: vi.fn(),
      }
      instances.push(instance)
      return instance
    }),
  }
})

// 注册函数在组件里调用，这里给个空实现避免拉入真实 echarts 模块图
vi.mock('../src/register', () => ({
  registerFbkCharts: vi.fn(),
  isFbkChartsRegistered: () => true,
}))

import FbkChart from '../src/FbkChart.vue'

const mountChart = (props: Record<string, any> = {}) =>
  mount(FbkChart, {
    props: { option: { series: [{ type: 'line', data: [1, 2, 3] }] }, ...props },
    attachTo: document.body,
  })

/**
 * jsdom 里元素默认 clientWidth/clientHeight 都是 0，
 * 而 FbkChart 会等到有尺寸才 init（防止 ECharts 定格在 0 尺寸）。
 * 这里给容器伪造尺寸。
 */
function stubSize(width = 400, height = 300) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => height,
  })
}

beforeEach(() => {
  instances.length = 0
  stubSize()
})

describe('FbkChart 生命周期', () => {
  it('挂载后创建实例并调用 setOption', async () => {
    mountChart()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    expect(instances.length).toBeGreaterThan(0)
    expect(instances[0]!.setOption).toHaveBeenCalled()
    /* 只断言「调用过」抓不到合并策略的错误：notMerge:false 一样会调用，
       但系列变少时会留下幽灵系列、legend 置空时图例不会消失。
       这里钉住 replaceMerge —— 它才是那两条正确行为的来源。 */
    const options = instances[0]!.setOption.mock.calls[0][1] as { replaceMerge?: string[] }
    expect(options.replaceMerge).toEqual(expect.arrayContaining(['series', 'legend']))
  })

  it('卸载时 dispose 实例（防内存泄漏）', async () => {
    const wrapper = mountChart()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    const instance = instances[0]!

    wrapper.unmount()
    expect(instance.dispose).toHaveBeenCalled()
  })

  it('尺寸为 0 时不 init（避免 ECharts 定格在 0 尺寸）', async () => {
    stubSize(0, 0)
    mountChart()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    // 这条防的是大屏里"图表全空白"的经典问题
    expect(instances.length).toBe(0)
  })
})

describe('FbkChart option 处理', () => {
  it('某类组件整个消失时改用 notMerge —— 残留的缩放条才会被清掉', async () => {
    /* 合并语义下「新 option 没给 dataZoom」= 「别动」，旧缩放条会永远留着。
       replaceMerge 里直接点名 dataZoom 在 echarts 层是可行的，但在大屏页面里
       会让整页不渲染（根因未定位），所以这里绕开它：形状收缩的那一次整块重设。 */
    const withZoom = {
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'slider' }],
      series: [{ type: 'line', data: [1, 2] }],
    }
    const withoutZoom = {
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [3, 4] }],
    }

    const wrapper = mountChart({ option: withZoom })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    await wrapper.setProps({ option: withoutZoom })
    await flushPromises()

    const calls = instances[0]!.setOption.mock.calls
    expect(calls.length, '第二次更新没有发生').toBeGreaterThanOrEqual(2)
    const second = calls.at(-1)![1] as { notMerge?: boolean; replaceMerge?: string[] }
    expect(second.notMerge, 'dataZoom 消失时没有走 notMerge，缩放条会残留').toBe(true)
    wrapper.unmount()
  })

  it('形状不变时仍走 replaceMerge（不重置动画与缩放位置）', async () => {
    const option = (data: number[]) => ({
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'slider' }],
      series: [{ type: 'line', data }],
    })
    const wrapper = mountChart({ option: option([1, 2]) })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    await wrapper.setProps({ option: option([3, 4]) })
    await flushPromises()

    const second = instances[0]!.setOption.mock.calls.at(-1)![1] as {
      notMerge?: boolean
      replaceMerge?: string[]
    }
    expect(second.notMerge, '只是换数据不该整块重建').toBeFalsy()
    expect(second.replaceMerge).toEqual(expect.arrayContaining(['series', 'legend']))
    wrapper.unmount()
  })

  it('反复收缩要能反复触发 —— 记账必须跟着 notMerge 一起重置', async () => {
    /* 可达的序列：带 dataZoom → 不带（notMerge，实例被清空）→ 又带 → 又不带。
       第二轮收缩仍然必须走 notMerge：如果记账没重置（例如只在 init 时清），
       第二次会以为实例上还有 dataZoom 而不触发。 */
    const mk = (withZoom: boolean) => {
      const opt: Record<string, any> = {
        xAxis: { type: 'category', data: ['a'] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: [1] }],
      }
      if (withZoom) opt.dataZoom = [{ type: 'slider' }]
      return opt
    }
    const wrapper = mountChart({ option: mk(true) })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    for (const [step, withZoom] of [['第一次收缩', false], ['重新加上', true], ['第二次收缩', false]] as const) {
      await wrapper.setProps({ option: mk(withZoom) })
      await flushPromises()
      const opts = instances[0]!.setOption.mock.calls.at(-1)![1] as any
      if (withZoom) expect(opts.notMerge, step + '：加组件不该整块重建').toBeFalsy()
      else expect(opts.notMerge, step + '：没走 notMerge，缩放条会残留').toBe(true)
    }
    wrapper.unmount()
  })

  it('setOption 前把 CSS 变量解析成真实色值', async () => {
    document.documentElement.style.setProperty('--fbk-chart-1', '#123456')
    mountChart({
      option: { series: [{ type: 'line', data: [1], itemStyle: { color: 'var(--fbk-chart-1)' } }] },
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const passed = instances[0]!.setOption.mock.calls[0][0]
    expect(passed.series[0].itemStyle.color).toBe('#123456')
    document.documentElement.removeAttribute('style')
  })

  it('option 变化时重新 setOption', async () => {
    const wrapper = mountChart()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    const instance = instances[0]!

    await wrapper.setProps({ option: { series: [{ type: 'bar', data: [9] }] } })
    await flushPromises()

    expect(instance.setOption.mock.calls.length).toBeGreaterThan(1)
  })
})

describe('FbkChart 空态', () => {
  it('series 为空时显示空态文案', async () => {
    const wrapper = mountChart({ option: { series: [] } })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('series 有数据但不显示空态', async () => {
    const wrapper = mountChart()
    await flushPromises()
    expect(wrapper.find('.fbk-chart__empty').exists()).toBe(false)
  })

  it('emptyText 可自定义', async () => {
    const wrapper = mountChart({ option: { series: [] }, emptyText: '没有记录' })
    await flushPromises()
    expect(wrapper.text()).toContain('没有记录')
  })

  it('emptyText 传空字符串时关闭空态', async () => {
    const wrapper = mountChart({ option: { series: [] }, emptyText: '' })
    await flushPromises()
    expect(wrapper.find('.fbk-chart__empty').exists()).toBe(false)
  })

  it('isEmpty 可显式覆盖自动判定', async () => {
    const wrapper = mountChart({ isEmpty: true })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无数据')
  })
})

describe('FbkChart 高度', () => {
  it('数字高度自动补 px', async () => {
    const wrapper = mountChart({ height: 300 })
    await flushPromises()
    expect((wrapper.element as HTMLElement).style.height).toBe('300px')
  })

  it('字符串高度原样使用', async () => {
    const wrapper = mountChart({ height: '50vh' })
    await flushPromises()
    expect((wrapper.element as HTMLElement).style.height).toBe('50vh')
  })

  it('不传高度时用 CSS 令牌的默认值', async () => {
    const wrapper = mountChart()
    await flushPromises()
    expect((wrapper.element as HTMLElement).style.height).toBe('')
  })
})

describe('FbkChart 加载态', () => {
  it('loading 时调用 showLoading', async () => {
    const wrapper = mountChart({ loading: false })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    const instance = instances[0]!

    await wrapper.setProps({ loading: true })
    await flushPromises()
    expect(instance.showLoading).toHaveBeenCalled()
  })

  it('loading 结束时调用 hideLoading', async () => {
    const wrapper = mountChart({ loading: true })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    const instance = instances[0]!

    await wrapper.setProps({ loading: false })
    await flushPromises()
    expect(instance.hideLoading).toHaveBeenCalled()
  })
})
