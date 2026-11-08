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
    expect(instances[0]!.setOption.mock.calls[0][1]).toMatchObject({
      replaceMerge: ['series', 'legend'],
    })
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
