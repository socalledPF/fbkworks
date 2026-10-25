import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

/**
 * 图表错误处理。
 *
 * 核心承诺：**一个图表渲染失败不该让整页白屏。**
 * init 或 setOption 抛错时，组件降级为空态并通过 error 事件上报。
 */

const initMock = vi.fn()

vi.mock('echarts/core', () => ({
  init: (...args: unknown[]) => initMock(...args),
}))

vi.mock('../src/register', () => ({
  registerFbkCharts: vi.fn(),
  isFbkChartsRegistered: () => true,
}))

import FbkChart from '../src/FbkChart.vue'

function stubSize(w = 400, h = 300) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => w })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => h })
}

beforeEach(() => {
  initMock.mockReset()
  stubSize()
})

describe('init 失败', () => {
  it('捕获异常并通过 error 事件上报，不冒泡到全局', async () => {
    initMock.mockImplementation(() => {
      throw new Error('init 失败')
    })

    const wrapper = mount(FbkChart, {
      props: { option: { series: [{ type: 'line', data: [1] }] } },
      attachTo: document.body,
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.emitted('error')).toBeTruthy()
    expect((wrapper.emitted('error')![0]![0] as Error).message).toBe('init 失败')
    wrapper.unmount()
  })

  it('init 失败后组件仍然挂载（空态可见）', async () => {
    initMock.mockImplementation(() => {
      throw new Error('boom')
    })
    const wrapper = mount(FbkChart, {
      props: { option: { series: [] } },
      attachTo: document.body,
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    // 没有抛到全局，容器还在
    expect(wrapper.find('.fbk-chart').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('setOption 失败', () => {
  it('捕获并上报，保留上一帧', async () => {
    const setOption = vi.fn()
    initMock.mockReturnValue({
      setOption,
      resize: vi.fn(),
      dispose: vi.fn(),
      on: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    setOption.mockImplementation(() => {
      throw new Error('非法配置')
    })

    const wrapper = mount(FbkChart, {
      props: { option: { series: [{ type: 'line', data: [1] }] } },
      attachTo: document.body,
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.emitted('error')).toBeTruthy()
    expect((wrapper.emitted('error')![0]![0] as Error).message).toBe('非法配置')
    wrapper.unmount()
  })
})

describe('正常路径不受影响', () => {
  it('成功时不产生 error 事件', async () => {
    initMock.mockReturnValue({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      on: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    const wrapper = mount(FbkChart, {
      props: { option: { series: [{ type: 'line', data: [1] }] } },
      attachTo: document.body,
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.emitted('error')).toBeFalsy()
    wrapper.unmount()
  })
})
