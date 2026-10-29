import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProvider } from '@fbkworks/test-utils'
import { naiveUiAdapter } from '../src'

/**
 * 同 element-plus：DialogProps.placement 此前在 naive 适配器里无人读取（审查 B12）。
 *
 * naive 的 NModal 用 .n-modal-scroll-content（display:flex）承载内容，
 * 卡片自己靠 align-self 决定垂直位置 —— 顶部弹出的模态框是 center，
 * 底部弹层是 flex-end。断言落在卡片真实的行内样式上，不是类名装饰。
 */

const mountDialog = async (placement: 'center' | 'bottom') => {
  const wrapper = mountWithProvider(naiveUiAdapter.primitives.Dialog, {
    adapter: naiveUiAdapter,
    props: { modelValue: true, title: '标题', placement },
  })
  await flushPromises()
  return wrapper
}

/** naive 的 NModal 经 VLazyTeleport 挂到 body，不在 wrapper 的 DOM 里 */
const cardOf = () => document.body.querySelector<HTMLElement>('.n-card')

describe('naive-ui Dialog 的 placement', () => {
  it('placement=bottom 时卡片贴底并铺满宽度', async () => {
    const wrapper = await mountDialog('bottom')
    const card = cardOf()
    expect(card, '弹窗卡片没有渲染到 body').toBeTruthy()
    expect(card?.classList.contains('fbk-naive-dialog--bottom'), 'placement=bottom 必须留可测试的标记类').toBe(true)
    expect(card?.style.alignSelf, 'placement=bottom 必须贴底').toBe('flex-end')
    expect(card?.style.width, 'placement=bottom 必须铺满宽度').toBe('100%')
    wrapper.unmount()
  })

  it('placement=center 时不贴底', async () => {
    const wrapper = await mountDialog('center')
    const card = cardOf()
    expect(card, '弹窗卡片没有渲染到 body').toBeTruthy()
    expect(card?.classList.contains('fbk-naive-dialog--bottom')).toBe(false)
    expect(card?.style.alignSelf, 'placement=center 不应把卡片推到贴底').not.toBe('flex-end')
    wrapper.unmount()
  })
})
