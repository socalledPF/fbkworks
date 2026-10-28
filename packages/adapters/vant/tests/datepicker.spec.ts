import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { resetWarnCache } from '@fbk/shared'
import { mountWithProvider } from '@fbk/test-utils'
import { vantAdapter } from '../src'

/**
 * 移动端 DatePicker 的类型边界。
 *
 * vant4 的日期滚轮只有 year/month/day 三列，没有时分列，也没有成对选区间的形态。
 * 这组用例锁死一件事：撑不住的 type 必须显式失败（挂载即告警 + 不可用），
 * 而不是把用户选的时分静默补成 00:00:00、把区间静默塌成单值。
 */

const mountPicker = (props: Record<string, any> = {}) =>
  mountWithProvider(vantAdapter.primitives.DatePicker, { adapter: vantAdapter, props })

/** Popup 挂在 body 上，事件还得从组件实例上读，这里统一取被测组件。 */
const pickerOf = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findComponent(vantAdapter.primitives.DatePicker)

const emittedValues = (wrapper: ReturnType<typeof mountPicker>): string[] => {
  const events = pickerOf(wrapper).emitted('update:modelValue') ?? []
  return events.map((args) => (args as string[])[0])
}

/** 点开 Field，让 Popup 渲染滚轮（vant Popup 默认懒渲染，不点开没有 picker 实例）。 */
const openField = async (wrapper: ReturnType<typeof mountPicker>) => {
  await wrapper.find('.fbk-vant-date-picker .van-cell').trigger('click')
  await flushPromises()
}

/**
 * 尽力在滚轮上点「确认」。
 * 返回 false 表示组件根本没挂滚轮 —— 那正是拒绝形态的期望结果。
 */
const tryConfirm = async (
  wrapper: ReturnType<typeof mountPicker>,
  selectedValues: string[],
) => {
  const wheel = wrapper.findComponent({ name: 'van-date-picker' })
  if (!wheel.exists()) return false
  wheel.vm.$emit('confirm', { selectedValues })
  await flushPromises()
  return true
}

/** 组件自身发出的告警（过滤掉 vue / vant 自己的 console.warn）。 */
const fbkWarnings = () => warned.map((line) => line).filter((line) => line.includes('[fbk]'))

let warned: string[] = []

beforeEach(() => {
  warned = []
  resetWarnCache()
  vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    warned.push(args.map(String).join(' '))
  })
})

describe('vant DatePicker / 类型边界', () => {
  it('type="time" 挂载即告警，且不再产出 00:00:00', async () => {
    const wrapper = mountPicker({ type: 'time' })
    await flushPromises()

    await openField(wrapper)
    await tryConfirm(wrapper, ['2024', '6', '15'])

    // 修复前这里拿到 ['00:00:00']：用户选了时间，落库是凌晨零点
    expect(emittedValues(wrapper)).not.toContain('00:00:00')
    expect(pickerOf(wrapper).emitted('update:modelValue')).toBeUndefined()
    // 一进页面就得说清楚，不能等到用户点开才暴露
    expect(fbkWarnings().join('\n')).toContain('type="time"')
  })

  it('type="time" 进入不可用态：点开不出现滚轮', async () => {
    const wrapper = mountPicker({ type: 'time' })
    await flushPromises()
    await openField(wrapper)

    expect(wrapper.findComponent({ name: 'van-date-picker' }).exists()).toBe(false)
  })

  it('type="datetime" 带时分回填时滚轮不炸', async () => {
    const wrapper = mountPicker({ type: 'datetime', modelValue: '2024-06-15 09:30:00' })
    await flushPromises()

    // 5 段值塞进 3 列滚轮，修复前 vant 内部会抛 TypeError
    await openField(wrapper)

    expect(wrapper.findComponent({ name: 'van-date-picker' }).exists()).toBe(false)
  })

  it('type="datetime" 挂载即告警，且不把时分静默清零', async () => {
    const wrapper = mountPicker({ type: 'datetime' })
    await flushPromises()

    await openField(wrapper)
    await tryConfirm(wrapper, ['2024', '6', '15'])

    // 修复前这里拿到 ['2024-06-15 00:00:00']：日期留下了，时分被吃掉
    expect(emittedValues(wrapper)).not.toContain('2024-06-15 00:00:00')
    expect(pickerOf(wrapper).emitted('update:modelValue')).toBeUndefined()
    expect(fbkWarnings().join('\n')).toContain('type="datetime"')
  })

  it('type="daterange" 挂载即告警，且不再 emit 单值', async () => {
    const wrapper = mountPicker({
      type: 'daterange',
      modelValue: ['2024-06-01', '2024-06-10'],
    })
    await flushPromises()

    await openField(wrapper)
    await tryConfirm(wrapper, ['2024', '6', '15'])

    // 修复前 emit 出来的是字符串 '2024-06-15'，与 string[] 契约不符
    expect(pickerOf(wrapper).emitted('update:modelValue')).toBeUndefined()
    expect(fbkWarnings().join('\n')).toContain('type="daterange"')
  })

  it('type="datetimerange" 同样被拒绝', async () => {
    const wrapper = mountPicker({ type: 'datetimerange' })
    await flushPromises()

    expect(fbkWarnings().join('\n')).toContain('type="datetimerange"')

    await openField(wrapper)
    await tryConfirm(wrapper, ['2024', '6', '15'])

    expect(pickerOf(wrapper).emitted('update:modelValue')).toBeUndefined()
  })

  it('type="date" 不受影响：照常产出 YYYY-MM-DD', async () => {
    const wrapper = mountPicker({ type: 'date', modelValue: '2024-06-15' })
    await flushPromises()

    expect(fbkWarnings()).toEqual([])

    await openField(wrapper)
    const confirmed = await tryConfirm(wrapper, ['2020', '1', '5'])
    expect(confirmed).toBe(true)

    expect(emittedValues(wrapper)).toEqual(['2020-01-05'])
    expect(pickerOf(wrapper).emitted('change')).toEqual([['2020-01-05']])
  })

  it('type="date" 回填的 modelValue 决定滚轮初始分段', async () => {
    const wrapper = mountPicker({ type: 'date', modelValue: '2024-06-15' })
    await flushPromises()
    await openField(wrapper)

    expect(wrapper.findComponent({ name: 'van-date-picker' }).props('modelValue')).toEqual([
      '2024',
      '06',
      '15',
    ])
  })

  it('type="date" 打开后确认会收起弹层', async () => {
    const wrapper = mountPicker({ type: 'date' })
    await flushPromises()
    await openField(wrapper)
    await tryConfirm(wrapper, ['2024', '6', '15'])

    expect(wrapper.find('.van-popup--bottom').exists()).toBe(false)
  })
})
