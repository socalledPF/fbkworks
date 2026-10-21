#!/usr/bin/env node
/**
 * 样式接入校验。
 *
 * 起因：FormModal / CrudPage / Result 三个组件的 style.css 写好了，
 * 但既没进 styles/index.css，也没进 playground 的样式入口 ——
 * 于是 display:flex 与 gap 全部失效，弹窗底部两个按钮紧贴在一起。
 * 测试全绿、类型全对，肉眼一看就是坏的。
 *
 * 这个脚本检查三件事：
 *   1. 每个组件的 style.css 都登记到了 styles/index.css
 *   2. 每个组件的 style.css 都登记到了 playground 的样式入口
 *   3. CSS 里用了 gap / justify-content / align-items 的规则块，
 *      同一块内必须有 display: flex / grid —— 否则那些属性静默失效
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const componentsDir = join(root, 'packages', 'components', 'src')
const aggregate = join(componentsDir, 'styles', 'index.css')
const playgroundStyles = join(root, 'apps', 'playground', 'src', 'styles.ts')

const problems = []

/* ---------- 1 & 2：样式接入登记 ---------- */

const entries = await readdir(componentsDir, { withFileTypes: true })
const components = []
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'styles') continue
  try {
    await stat(join(componentsDir, entry.name, 'style.css'))
    components.push(entry.name)
  } catch {
    // 该组件没有独立样式文件
  }
}

const aggregateCss = await readFile(aggregate, 'utf8')
const playgroundCss = await readFile(playgroundStyles, 'utf8')

for (const name of components) {
  if (!aggregateCss.includes(`../${name}/style.css`)) {
    problems.push(
      `[接入] 组件 "${name}" 的 style.css 没有登记到 packages/components/src/styles/index.css`,
    )
  }
  if (!playgroundCss.includes(`@fbk/components/${name}/style.css`)) {
    problems.push(
      `[接入] 组件 "${name}" 的 style.css 没有登记到 apps/playground/src/styles.ts` +
        '（漏了这条，开发与评审时看不到真实效果）',
    )
  }
}

/* ---------- 3：布局属性必须有 display ---------- */

const FLEX_ONLY_PROPS = new Set([
  'gap',
  'row-gap',
  'column-gap',
  'justify-content',
  'align-items',
  'flex-direction',
  'flex-wrap',
])

/** 把规则体解析成 { prop, value } 列表。按分号切，比正则拼接可靠 */
function parseDeclarations(body) {
  const out = []
  for (const raw of body.split(';')) {
    const decl = raw.trim()
    if (!decl) continue
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    out.push({
      prop: decl.slice(0, idx).trim().toLowerCase(),
      value: decl.slice(idx + 1).trim(),
    })
  }
  return out
}

async function walkCss(dir) {
  const out = []
  let list
  try {
    list = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of list) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      out.push(...(await walkCss(full)))
    } else if (entry.name.endsWith('.css')) {
      out.push(full)
    }
  }
  return out
}

const cssFiles = [
  ...(await walkCss(componentsDir)),
  ...(await walkCss(join(root, 'packages', 'adapters'))),
  ...(await walkCss(join(root, 'packages', 'tokens', 'src', 'css'))),
]

/* 先建一张「选择器 → 是否声明过 display:flex/grid」的全局表。
   样式里常见的写法是基础规则给 display、修饰类只覆盖 gap ——
   这种情况下修饰类本身没有 display 是**正确**的，不该报错。
   只有「这个选择器在任何地方都没声明过 display」才是真问题。 */
const displayBySelector = new Map()
const parsedFiles = []

for (const file of cssFiles) {
  const css = await readFile(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  parsedFiles.push({ rel, stripped })

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(stripped))) {
    const selector = m[1].trim()
    if (selector.startsWith('@')) continue
    const decls = parseDeclarations(m[2])
    const has = decls.some((d) => d.prop === 'display' && /^(inline-)?(flex|grid)$/.test(d.value))
    if (has) displayBySelector.set(selector, true)
    else if (!displayBySelector.has(selector)) displayBySelector.set(selector, false)
  }
}

for (const { rel, stripped } of parsedFiles) {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = ruleRe.exec(stripped))) {
    const selector = match[1].trim()
    if (selector.startsWith('@')) continue

    /* 跳过位于 @media / @supports 块内的规则。
       这类规则通常只覆盖部分属性（例如媒体查询里只改 justify-content），
       它依赖外层同选择器提供的 display —— 单独看它必然"缺 display"，
       属于误报。判断方式：看该规则之前最近的未闭合 @ 块。 */
    const before = stripped.slice(0, match.index)
    const openAtRules = (before.match(/@(media|supports|container)[^{]*\{/g) ?? []).length
    const closedBraces = (before.match(/\}/g) ?? []).length
    const openBraces = (before.match(/\{/g) ?? []).length
    // 未闭合的大括号数量 > 0 说明当前规则嵌在某个块里
    if (openBraces - closedBraces > 0 && openAtRules > 0) continue

    const decls = parseDeclarations(match[2])
    const usedFlexProps = [...FLEX_ONLY_PROPS].filter((prop) => decls.some((d) => d.prop === prop))
    if (!usedFlexProps.length) continue

    const hasDisplay = decls.some(
      (d) => d.prop === 'display' && /^(inline-)?(flex|grid)$/.test(d.value),
    )
    /* 自身没写 display 时，只要满足任一条就不算错：
       1. 同一选择器在别处声明过 display（修饰类覆盖的常见写法）
       2. 它是某个已声明 display 的选择器的后代（如 .x--vertical .x__item）
       3. 它带修饰类前缀且基础选择器有 display（如 .x--gap-sm ← .x） */
    const baseSelector = selector.replace(/--[\w-]+/g, '').replace(/\.([\w-]+)__(\w+)/, '.$1__$2')
    /* 取选择器的「最后一段」（如 `.x--vertical .x__item` → `.x__item`），
       看这个目标元素在别处是否声明过 display。
       后代选择器只覆盖目标元素的属性，display 由基础规则提供是常规写法。 */
    const lastSegment = selector.split(/\s+/).pop() ?? selector
    const covered =
      displayBySelector.get(selector) === true ||
      displayBySelector.get(lastSegment) === true ||
      displayBySelector.get(baseSelector) === true

    if (!hasDisplay && !covered) {
      problems.push(
        `[布局] ${rel} 的规则 "${selector.slice(0, 60)}" 使用了 ${usedFlexProps.join(', ')}` +
          ' 但没有 display: flex / grid —— 这些属性会静默失效',
      )
    }
  }
}


/* ---------- 4：demo 模板里的原生控件必须有样式类 ---------- */

/**
 * demo 是评审材料，里面的原生 <button> / <select> / <input> 若不带
 * fbk-demo-* 或 playground__* 类，就会呈现浏览器默认外观（16px 字号、
 * 2px 边框），与被演示的组件完全是两套视觉语言。
 *
 * 只扫 packages/internal/demos 与 apps/playground —— 业务组件内部
 * 允许使用原生标签（它们由组件自己的 style.css 负责）。
 */
const RAW_CONTROL_RE = /<(button|select|input)\b[^>]*>/g
const STYLE_CLASS_RE = /class="([^"]*)"/ 

async function walkVue(dir) {
  const out = []
  let list
  try {
    list = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of list) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      out.push(...(await walkVue(full)))
    } else if (entry.name.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

const demoTemplates = [
  ...(await walkVue(join(root, 'packages', 'internal', 'demos'))),
  ...(await walkVue(join(root, 'apps', 'playground', 'src'))),
]

for (const file of demoTemplates) {
  const src = await readFile(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  // 只看 template 部分
  const tplStart = src.indexOf('<template>')
  if (tplStart === -1) continue
  // 去掉 HTML 注释：注释里出现的 <button> 不是真实元素
  const tpl = src.slice(tplStart).replace(/<!--[\s\S]*?-->/g, '')

  let m
  while ((m = RAW_CONTROL_RE.exec(tpl))) {
    const tag = m[0]
    const clsMatch = tag.match(STYLE_CLASS_RE)
    const cls = clsMatch ? clsMatch[1] : ''
    let styled =
      cls.includes('fbk-demo-') || cls.includes('playground__') || cls.includes('fbk-')

    /* 也接受「父级带样式类」的写法：Playground 的 <select> 就是靠
       外层 .playground__field 定位的，自身不需要类。
       做法：从标签位置往前找最近的开始标签，看它是否带样式类。 */
    if (!styled) {
      const before = tpl.slice(0, m.index)
      const ancestors = [...before.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)].slice(-3)
      styled = ancestors.some((a) => {
        const c = (a[2].match(STYLE_CLASS_RE) || [])[1] || ''
        return c.includes('playground__') || c.includes('fbk-demo-') || c.includes('fbk-')
      })
    }

    if (!styled) {
      problems.push(
        `[demo] ${rel} 里的原生 <${m[1]}> 没有 fbk-demo-* 或 playground__* 样式类` +
          '（会呈现浏览器默认外观）',
      )
    }
  }
}

/* ---------- 输出 ---------- */

if (problems.length) {
  console.error(`\n[check-styles] 发现 ${problems.length} 个问题：\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`[check-styles] OK：${components.length} 个组件样式均已接入，布局声明无遗漏`)
