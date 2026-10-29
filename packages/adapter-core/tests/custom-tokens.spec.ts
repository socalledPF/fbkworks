import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createMockAdapter } from '@fbkworks/test-utils'
import { defaultTokens, type FbkTokens } from '@fbkworks/tokens'
import { createBusinessKit, FbkProvider } from '../src/plugin'

/**
 * F15：接上 toCssVars()，让 createBusinessKit({ tokens }) 的自定义令牌真正生效。
 *
 * 注入方式是 **cssText 写进 <style id="fbk-custom-tokens">**，不是行内变量。
 * 行内变量（element.style.setProperty）会无条件压过 dark.css / cyber.css 的
 * html[data-fbk-theme] 规则，主题切换直接失效 —— 正是 checkpoint §6.7 记的那个坑。
 * 用 <style> 则与其它 CSS 同源，靠「特异性 + 文档顺序」竞争：
 *   · 基础令牌：同为 :root，注入的更靠后 → 自定义值胜出；
 *   · 主题覆盖：html[data-fbk-theme] 特异性 (0,1,1) > :root (0,1,0) → 主题胜出。
 *
 * jsdom 只实现文档顺序、不实现特异性（node_modules/jsdom/lib/jsdom/living/helpers/
 * style-rules.js:177-178 自认）。所以暗色那一半用下面的 cascadeWinner() 按 CSS 级联
 * 规范在真实 CSS 文本上求解，并与真实浏览器的 getComputedStyle 对照过（见 F15 报告）。
 */

const STYLE_ID = 'fbk-custom-tokens'
const cssDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../tokens/src/css')

const apps: App[] = []
const containers: HTMLElement[] = []

const injectedStyle = () => document.getElementById(STYLE_ID) as HTMLStyleElement | null

function customTokens(patch: { spacingMd?: string; primary?: string } = {}): FbkTokens {
  const { spacingMd = '99px', primary = '#ff0000' } = patch
  return {
    ...defaultTokens,
    color: { ...defaultTokens.color, primary },
    spacing: { ...defaultTokens.spacing, md: spacingMd },
  }
}

function mountApp(app: App): void {
  const el = document.createElement('div')
  document.body.appendChild(el)
  containers.push(el)
  apps.push(app)
  app.mount(el)
}

/** 用例内主动卸载：从待清理列表摘掉，避免 afterEach 重复 unmount */
function unmountApp(app: App): void {
  const index = apps.indexOf(app)
  if (index !== -1) apps.splice(index, 1)
  app.unmount()
}

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** 把编译产物按真实文档顺序放进 head（@import 由打包器解析，这里手动展开） */
function injectCss(file: string): void {
  const css = stripComments(readFileSync(resolve(cssDir, file), 'utf8')).replace(/@import[^;]+;/g, '')
  const el = document.createElement('style')
  el.setAttribute('data-test-css', file)
  el.textContent = css
  document.head.appendChild(el)
}

interface Declaration {
  selector: string
  name: string
  value: string
  order: number
}

/** 按文档顺序收集当前文档里所有 --fbk-* 声明（注入的 <style> 也在内） */
function collectDeclarations(): Declaration[] {
  const out: Declaration[] = []
  let order = 0
  for (const style of Array.from(document.querySelectorAll('style'))) {
    const css = stripComments(style.textContent ?? '')
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = rule[1].trim()
      for (const decl of rule[2].split(';')) {
        const index = decl.indexOf(':')
        if (index === -1) continue
        const name = decl.slice(0, index).trim()
        if (!name.startsWith('--fbk')) continue
        out.push({ selector, name, value: decl.slice(index + 1).trim(), order: order++ })
      }
    }
  }
  return out
}

/** [id, class/属性/伪类, 类型]；只覆盖本文件用到的选择器形态 */
function specificity(selector: string): [number, number, number] {
  const bare = selector.replace(/'[^']*'|"[^"]*"/g, '')
  const ids = (bare.match(/#[\w-]+/g) ?? []).length
  const attributes = (bare.match(/\[[^\]]*\]/g) ?? []).length
  const classes = (bare.match(/\.[\w-]+/g) ?? []).length
  const pseudoClasses = (bare.match(/(?<!:):(?!:)[\w-]+/g) ?? []).length
  const types = (bare.match(/(?:^|[\s>+~,])[a-zA-Z][\w-]*/g) ?? []).length
  return [ids, classes + attributes + pseudoClasses, types]
}

const compareSpecificity = (a: [number, number, number], b: [number, number, number]) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** 级联求解：特异性高者胜；同特异性取文档顺序更后的 */
function cascadeWinner(name: string): Declaration | undefined {
  const matched = collectDeclarations()
    .filter((d) => d.name === name)
    .map((decl) => ({
      decl,
      // 逗号选择器列表取命中项里的最高特异性
      specificity: decl.selector
        .split(',')
        .map((s) => s.trim())
        .filter((s) => document.documentElement.matches(s))
        .map(specificity)
        .sort(compareSpecificity)
        .pop(),
    }))
    .filter((entry) => entry.specificity)

  matched.sort(
    (a, b) => compareSpecificity(a.specificity!, b.specificity!) || a.decl.order - b.decl.order,
  )
  return matched.pop()?.decl
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const app of apps.splice(0)) app.unmount()
  for (const el of containers.splice(0)) el.remove()
  for (const el of Array.from(document.querySelectorAll('style'))) el.remove()
  document.documentElement.removeAttribute('data-fbk-theme')
  document.documentElement.removeAttribute('style')
})

describe('自定义 tokens 注入为 <style>', () => {
  it('插件 install 后 document 里有该变量的 <style>，getComputedStyle 读到新值', async () => {
    const app = createApp({ render: () => h('i') })
    app.use(createBusinessKit({ adapter: createMockAdapter(), tokens: customTokens() }))
    mountApp(app)
    await nextTick()

    const style = injectedStyle()
    expect(style, '自定义 tokens 没有注入：toCssVars() 仍然零消费者').not.toBeNull()
    expect(style!.textContent).toContain('--fbk-spacing-md: 99px;')
    expect(readVar('--fbk-spacing-md')).toBe('99px')

    // 必须是 <style> 规则，不能是根元素行内变量 —— 行内会压过主题规则
    expect(style!.textContent!.startsWith(':root{')).toBe(true)
    expect(document.documentElement.getAttribute('style') ?? '').not.toContain('--fbk')
  })

  it('不传 tokens 时不注入任何 <style>', async () => {
    const app = createApp({ render: () => h('i') })
    app.use(createBusinessKit({ adapter: createMockAdapter() }))
    mountApp(app)
    await nextTick()

    expect(injectedStyle()).toBeNull()
    expect(document.head.querySelectorAll('style')).toHaveLength(0)
    expect(document.documentElement.getAttribute('style') ?? '').not.toContain('--fbk')
  })

  it('重复安装 / 多个 Provider 只产生一个 <style>，内层的令牌生效', async () => {
    // 重复 install 必然触发 Vue 的「重复 provide / 指令」警告，那正是本用例的输入
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = createMockAdapter()
    const app = createApp({
      render: () =>
        h(FbkProvider, { tokens: customTokens({ spacingMd: '77px' }) }, { default: () => h('i') }),
    })
    // 两个独立插件实例各 install 一次：Vue 只对「同一个插件对象」去重
    app.use(createBusinessKit({ adapter, tokens: customTokens({ spacingMd: '88px' }) }))
    app.use(createBusinessKit({ adapter, tokens: customTokens({ spacingMd: '88px' }) }))
    mountApp(app)
    await nextTick()

    expect(document.head.querySelectorAll('style')).toHaveLength(1)
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1)
    expect(injectedStyle()!.textContent).toContain('--fbk-spacing-md: 77px;')
    expect(readVar('--fbk-spacing-md')).toBe('77px')
  })

  it('Provider 卸载只撤掉自己那一层，全局 install 的样式保留到 app 卸载', async () => {
    const showProvider = ref(true)
    const app = createApp({
      render: () =>
        showProvider.value
          ? h(FbkProvider, { tokens: customTokens({ spacingMd: '77px' }) }, { default: () => h('i') })
          : h('i'),
    })
    app.use(
      createBusinessKit({ adapter: createMockAdapter(), tokens: customTokens({ spacingMd: '88px' }) }),
    )
    mountApp(app)
    await nextTick()
    expect(injectedStyle()!.textContent).toContain('--fbk-spacing-md: 77px;')

    showProvider.value = false
    await nextTick()
    expect(injectedStyle(), '全局 install 的样式应在应用生命周期内保留').not.toBeNull()
    expect(injectedStyle()!.textContent).toContain('--fbk-spacing-md: 88px;')

    unmountApp(app)
    expect(injectedStyle(), 'app 卸载后不应留下悬空的 <style>').toBeNull()
    expect(readVar('--fbk-spacing-md')).toBe('')
  })

  it('只用 <FbkProvider> 时，Provider 卸载后 <style> 一并移除', async () => {
    const showProvider = ref(true)
    const app = createApp({
      render: () =>
        showProvider.value
          ? h(
              FbkProvider,
              { adapter: createMockAdapter(), tokens: customTokens() },
              { default: () => h('i') },
            )
          : h('i'),
    })
    mountApp(app)
    await nextTick()
    expect(injectedStyle()).not.toBeNull()

    showProvider.value = false
    await nextTick()
    expect(injectedStyle()).toBeNull()
    expect(readVar('--fbk-spacing-md')).toBe('')
  })
})

describe('主题切换不被破坏', () => {
  it('dark.css 的 html[data-fbk-theme] 覆盖特异性更高，切换后仍然胜出', async () => {
    for (const file of ['primitives.css', 'tokens.css', 'dark.css']) injectCss(file)

    const app = createApp({ render: () => h('i') })
    app.use(createBusinessKit({ adapter: createMockAdapter(), tokens: customTokens({ primary: '#ff0000' }) }))
    mountApp(app)
    await nextTick()

    // 1) 注入的选择器必须是 :root：特异性 (0,1,0) 与 tokens.css 同级别，只能靠文档顺序取胜
    expect(injectedStyle()!.textContent!.startsWith(':root{')).toBe(true)
    expect(specificity(':root')).toEqual([0, 1, 0])
    expect(
      compareSpecificity(specificity("html[data-fbk-theme='dark']"), specificity(':root')),
    ).toBeGreaterThan(0)

    // 2) 浅色：同为 :root，注入的文档顺序更后 → 自定义值胜出（jsdom 实测）
    expect(readVar('--fbk-color-primary')).toBe('#ff0000')
    const light = cascadeWinner('--fbk-color-primary')
    expect(light?.selector).toBe(':root')
    expect(light?.value).toBe('#ff0000')

    // 3) 暗色：属性选择器特异性更高 → dark.css 的值胜出，自定义基础令牌不覆盖主题值
    document.documentElement.setAttribute('data-fbk-theme', 'dark')
    const themeDeclared = collectDeclarations().find(
      (d) => d.name === '--fbk-color-primary' && d.selector.includes('data-fbk-theme'),
    )
    expect(themeDeclared, 'dark.css 里应存在 --fbk-color-primary 的主题覆盖').toBeDefined()
    const dark = cascadeWinner('--fbk-color-primary')
    expect(dark?.selector).toContain("html[data-fbk-theme='dark']")
    expect(dark?.value).toBe(themeDeclared!.value)
    expect(dark?.value).not.toBe('#ff0000')

    // 4) 与主题无关的令牌（dark.css 不覆盖）在暗色下仍是自定义值
    expect(cascadeWinner('--fbk-spacing-md')?.value).toBe('99px')
  })
})
