import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProvider } from '@fbk/test-utils'
import { elementPlusAdapter } from '../src'

/**
 * DialogProps 声明了 placement，而 element-plus 适配器此前完全不读它
 * （审查 B12）—— 声明与实现脱节，业务方以为能拿到底部弹层，拿到的永远是
 * 距离顶部 15vh 的常规模态框。
 */

const mountDialog = async (placement: 'center' | 'bottom') => {
  const wrapper = mountWithProvider(elementPlusAdapter.primitives.Dialog, {
    adapter: elementPlusAdapter,
    props: { modelValue: true, title: '标题', placement },
  })
  await flushPromises()
  return wrapper
}

/** 弹窗本体（appendToBody 之后在 document.body 里） */
const dialogElement = () => document.body.querySelector<HTMLElement>('.el-dialog')

describe('element-plus Dialog 的 placement', () => {
  it('placement=center 走居中模态框', async () => {
    const wrapper = await mountDialog('center')
    const dialog = dialogElement()
    expect(dialog, '弹窗没有渲染到 body').toBeTruthy()
    // is-align-center 是 element-plus 自己的居中实现（.el-dialog.is-align-center { margin: auto }）
    expect(dialog?.classList.contains('is-align-center'), 'placement=center 必须居中').toBe(true)
    expect(dialog?.classList.contains('fbk-dialog--bottom')).toBe(false)
    wrapper.unmount()
  })

  it('placement=bottom 走底部弹层，不再居中', async () => {
    const wrapper = await mountDialog('bottom')
    const dialog = dialogElement()
    expect(dialog?.classList.contains('fbk-dialog--bottom'), 'placement=bottom 必须贴底').toBe(true)
    expect(dialog?.classList.contains('is-align-center'), 'placement=bottom 不应同时居中').toBe(false)
    wrapper.unmount()
  })

  it('贴底样式真的存在（只有类名没有规则等于没生效）', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'src', 'style.css'), 'utf8')
    const container = css.match(/\.el-overlay-dialog:has\(\.fbk-dialog--bottom\)\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(container, '缺少把对话框推到视口底部的容器规则').toContain('justify-content: flex-end')
    // element-plus 默认 margin 是 15vh auto 50px，不重置的话贴底规则会被顶开
    const dialog = css.match(/\.el-dialog\.fbk-dialog--bottom\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(dialog, '缺少贴底对话框的 margin 重置').toContain('margin: 0 auto')
  })
})
