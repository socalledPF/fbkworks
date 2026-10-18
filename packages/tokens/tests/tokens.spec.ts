import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { darkColorOverrides, defaultTokens, toCssVars } from '../src/index'

/**
 * 令牌一致性测试。
 *
 * 这几类问题都不会报错，只会「样式不对」，排查成本极高，所以用测试钉死：
 *
 * 1. TS 与 CSS 变量名对不上 —— toCssVars() 注入的变量被浏览器静默忽略
 * 2. 暗色缺覆盖 —— 切到暗色后某一处还是白底，只在特定页面出现
 * 3. 语义层引用了不存在的原始令牌 —— 拼错的手滑
 * 4. 自引用 —— `--x: var(--x)` 会让该变量在计算值阶段直接失效
 */

const cssDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/css')

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (name: string) => strip(readFileSync(resolve(cssDir, name), 'utf8'))

const declaredVars = (css: string) => {
  const out = new Map<string, string>()
  for (const m of css.matchAll(/(--fbk-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim())
  return out
}

const referencedVars = (css: string) => {
  const out = new Set<string>()
  for (const m of css.matchAll(/var\(\s*(--fbk-[a-z0-9-]+)/g)) out.add(m[1])
  return out
}

const primitives = read('primitives.css')
const semantic = read('tokens.css')
const dark = read('dark.css')

const primitiveVars = declaredVars(primitives)
const semanticVars = declaredVars(semantic)
const darkVars = declaredVars(dark)

/** tokens.css 自己 @import 了 primitives.css，实际可用的是两者并集 */
const available = new Set([...primitiveVars.keys(), ...semanticVars.keys()])

/**
 * 明确不随主题变化的令牌：几何、排版、动效、层级。
 * 结尾用 (?:-|$) 而不是直接跟 -，否则 --fbk-font-family 这种本身就是完整名字的
 * 令牌会因为后面没有连字符而漏判（这个漏洞真的漏过一次，见 git 历史）。
 */
const THEME_AGNOSTIC =
  /^--fbk-(radius|spacing|font-family|font-size|font-weight|font-line-height|duration|easing|z-index|transition)(?:-|$)/

/** 浅色原始色阶不需要暗色重定义——它们本来就按主题取不同步 */
const isPrimitiveColor = (name: string) => /^--fbk-(gray|blue|green|amber|red|cyan)-/.test(name)

describe('令牌一致性', () => {
  it('toCssVars() 产出的变量在 CSS 里都有定义', () => {
    const missing = Object.keys(toCssVars()).filter((name) => !available.has(name))
    expect(missing, `以下变量由 toCssVars() 产出但 CSS 未定义：${missing.join(', ')}`).toEqual([])
  })

  it('toCssVars() 不产出 camelCase 变量名', () => {
    // 这是真实踩过的坑：color.primaryHover 曾展平成 --fbk-color-primaryHover，
    // 而 CSS 定义的是 --fbk-color-primary-hover，33 个变量里 27 个被静默忽略。
    const camel = Object.keys(toCssVars()).filter((name) => /[A-Z]/.test(name))
    expect(camel, `camelCase 变量会被浏览器忽略：${camel.join(', ')}`).toEqual([])
  })

  it('浅色语义令牌在 dark.css 里都有对应覆盖', () => {
    const missing = [...semanticVars.keys()].filter(
      (name) => !THEME_AGNOSTIC.test(name) && !isPrimitiveColor(name) && !darkVars.has(name),
    )
    expect(missing, `以下令牌没有暗色覆盖：${missing.join(', ')}`).toEqual([])
  })

  it('dark.css 只覆盖已存在的令牌', () => {
    const orphan = [...darkVars.keys()].filter((name) => !available.has(name))
    expect(orphan, `dark.css 覆盖了不存在的令牌：${orphan.join(', ')}`).toEqual([])
  })

  it('所有 var() 引用都指向已定义的令牌', () => {
    const problems: string[] = []
    for (const [file, css] of [
      ['primitives.css', primitives],
      ['tokens.css', semantic],
      ['dark.css', dark],
    ] as const) {
      for (const ref of referencedVars(css)) {
        if (!available.has(ref)) problems.push(`${file} → ${ref}`)
      }
    }
    expect(problems, `引用了未定义的令牌：${problems.join(', ')}`).toEqual([])
  })

  it('没有自引用的令牌', () => {
    // `--fbk-duration-fast: var(--fbk-duration-fast)` 这种写法不报错，
    // 但该变量会变成 invalid at computed-value time，等于没定义。
    const problems: string[] = []
    for (const [file, vars] of [
      ['primitives.css', primitiveVars],
      ['tokens.css', semanticVars],
      ['dark.css', darkVars],
    ] as const) {
      for (const [name, value] of vars) {
        if (new RegExp(`var\\(\\s*${name}\\s*\\)`).test(value)) problems.push(`${file} → ${name}`)
      }
    }
    expect(problems, `自引用令牌：${problems.join(', ')}`).toEqual([])
  })

  it('暗色覆盖的字段在 defaultTokens 里真实存在', () => {
    const orphan = Object.keys(darkColorOverrides).filter(
      (key) => !(key in defaultTokens.color),
    )
    expect(orphan, `darkColorOverrides 里有 defaultTokens 不认识的字段：${orphan.join(', ')}`).toEqual(
      [],
    )
  })
})
