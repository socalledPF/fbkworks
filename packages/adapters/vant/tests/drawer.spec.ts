import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProvider } from '@fbkworks/test-utils'
import { vantAdapter } from '../src'

/**
 * vant 的 van-popup 没有标题栏 —— 它只有一个可选的关闭图标。
 * 抽屉契约要求 title + 关闭按钮，所以标题栏由适配器自绘；
 * 这个文件钉住「标题栏确实是我们画的、并且画在 popup 内部」。
 */

const mountDrawer = async (props: Record<string, any> = {}) => {
  const wrapper = mountWithProvider(vantAdapter.primitives.Drawer, {
    adapter: vantAdapter,
    props: { modelValue: true, title: '详情', ...props },
    slots: { default: '抽屉正文' },
  })
  await flushPromises()
  return wrapper
}

const popup = () => document.body.querySelector<HTMLElement>('.van-popup')

describe('vant Drawer', () => {
  it('标题栏自绘在 popup 内部，标题与关闭按钮都在里面', async () => {
    const wrapper = await mountDrawer()
    const header = popup()?.querySelector<HTMLElement>('.fbk-vant-drawer__header')
    expect(header, '缺少自绘的标题栏').toBeTruthy()
    expect(header?.querySelector('.fbk-vant-drawer__title')?.textContent).toBe('详情')
    expect(header?.querySelector('.fbk-vant-drawer__close'), '标题栏里必须有关闭按钮').toBeTruthy()
    expect(document.body.textContent).toContain('抽屉正文')
    wrapper.unmount()
  })

  it('showClose=false 时不渲染关闭按钮', async () => {
    const wrapper = await mountDrawer({ showClose: false })
    expect(popup()?.querySelector('.fbk-vant-drawer__close')).toBeFalsy()
    wrapper.unmount()
  })

  it('placement=bottom 从底部弹出并铺满屏幕', async () => {
    const wrapper = await mountDrawer({ placement: 'bottom' })
    const element = popup()
    expect(element?.classList.contains('van-popup--bottom'), 'placement=bottom 必须从底部弹出').toBe(true)
    expect(element?.style.width, '移动端底部抽屉必须铺满宽度').toBe('100%')
    expect(element?.style.height, '移动端底部抽屉必须铺满高度').toBe('100%')
    wrapper.unmount()
  })

  it('placement=right 时宽度取 width（数字补 px）', async () => {
    const wrapper = await mountDrawer({ placement: 'right', width: 480 })
    const element = popup()
    expect(element?.classList.contains('van-popup--right')).toBe(true)
    expect(element?.style.width).toBe('480px')
    wrapper.unmount()
  })
})
