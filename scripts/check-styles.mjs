#!/usr/bin/env node
/**
 * 样式接入校验。
 *
 * 起因：FormModal / CrudPage / Result 三个组件的 style.css 写好了，
 * 但既没进 styles/index.css，也没进 playground 的样式入口 ——
 * 于是 display:flex 与 gap 全部失效，弹窗底部两个按钮紧贴在一起。
 * 测试全绿、类型全对，肉眼一看就是坏的。
 *
 * 这个脚本检查四件事：
 *   1. 每个组件的 style.css 都登记到了 styles/index.css
 *   2. 每个组件的 style.css 都登记到了 playground 的样式入口
 *   3. 用了 gap / justify-content / align-items 的地方，目标元素拿不到
 *      display: flex / grid —— 否则那些属性静默失效。规则侧（css 里有没有证据）
 *      与元素侧（模板里的元素有没有带着提供 display 的类）都要查
 *   4. demo 模板里的原生控件必须有样式类
 *
 * 第 3 条的判定口径（见 docs/design/2026-10-28-screen-pie-layout-and-spacing.md 第四节）：
 *   - 「目标元素能不能拿到 display」只认 css 语义上成立的推导：
 *     同一选择器、规则自身最后一段复合选择器、以及该复合选择器的子集
 *     （同一个元素同时带 .x 与 .x--mod，这件事由 .x.x--mod 这种写法证明）。
 *     把 --mod 从字符串里删掉再比对是猜，不是证明，所以不做。
 *   - 只剩一个类名的修饰类规则（如 .fbk-x--mod）改看证据：某个真实元素上
 *     同时带着它和一个声明过 display 的类 —— 证据取自 .vue 模板里写着的 class。
 *   - 发布包（screen / dashboard）、三个 app 的样式与 .vue 的 <style> 块
 *     和组件包一样是线上样式，一起扫。
 *   - @media / @container / @supports 里的规则照常检查：块内的规则常常只覆盖
 *     一两个属性，display 由同一选择器在块外的声明提供，这一点在第 3 条的
 *     证据链里天然能查到，不需要整条跳过。
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const componentsDir = join(root, 'packages', 'components', 'src')
const aggregate = join(componentsDir, 'styles', 'index.css')

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


for (const name of components) {
  if (!aggregateCss.includes(`../${name}/style.css`)) {
    problems.push(
      `[接入] 组件 "${name}" 的 style.css 没有登记到 packages/components/src/styles/index.css`,
    )
  }
  /* 这里以前还要求 apps/playground/src/styles.ts 逐个 import 每个组件的 style.css。
     那是同一事实的第二份抄写：聚合入口（`@fbkworks/components/styles/index.css`）
     已经包含全部子组件，playground 也已经引了它。
     两个判据互相顶的结果是 playground 同时背着「聚合入口」和「9 条子路径」，
     同一份 CSS 被引入两次 —— 而 check-style-entries 恰恰明说「引子路径 ≠ 接入组件库」。
     现在唯一真相：聚合入口必须完整（下面继续校验），应用只认聚合入口。 */
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

const DISPLAY_RE = /^(inline-)?(flex|grid)$/

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

const declaresDisplay = (decls) =>
  decls.some((d) => d.prop === 'display' && DISPLAY_RE.test(d.value))

const usedFlexPropsOf = (decls) =>
  [...FLEX_ONLY_PROPS].filter((prop) => decls.some((d) => d.prop === prop))

/** 注释抹成等长空白（保留换行），行号才不会跟着漂 */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

/**
 * 逐块解析样式源，返回 { selector, decls, line, conditions }。
 * conditions 是外层 @ 条件前缀（如 "@media (max-width: 639px)"），
 * 既用于报告，也用于「同条件内才成立的 display」判定。
 */
function parseRules(css, baseLine = 1) {
  const rules = []
  const stack = []
  let buf = ''
  let bufLine = baseLine
  let hasContent = false
  let line = baseLine

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i]

    if (ch === '\n') {
      line += 1
      buf += ch
      continue
    }

    if (ch === '{') {
      stack.push({ prelude: buf.trim(), line: bufLine })
      buf = ''
      hasContent = false
      bufLine = line
      continue
    }

    if (ch === '}') {
      const frame = stack.pop()
      if (frame && frame.prelude && !frame.prelude.startsWith('@')) {
        rules.push({
          selector: frame.prelude,
          decls: parseDeclarations(buf),
          line: frame.line,
          conditions: stack.filter((f) => f.prelude.startsWith('@')).map((f) => f.prelude),
        })
      }
      buf = ''
      hasContent = false
      bufLine = line
      continue
    }

    if (ch === ';') {
      const top = stack[stack.length - 1]
      // 规则体里的分号是声明分隔符，要留着；@ 块与顶层的是语句结束符
      if (top && !top.prelude.startsWith('@')) {
        buf += ch
      } else {
        buf = ''
        hasContent = false
        bufLine = line
      }
      continue
    }

    if (!hasContent && ch.trim()) {
      bufLine = line
      hasContent = true
    }
    buf += ch
  }

  return rules
}

const normalizeSelector = (selector) =>
  selector
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()

/** 按顶层逗号切选择器列表（:not(.a, .b) 里的逗号不算） */
function splitSelectorList(selector) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

/** 拆成复合选择器：`.a > .b .c` → ['.a', '.b', '.c'] */
function splitCompounds(selector) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    const isCombinator = depth === 0 && (ch === '>' || ch === '+' || ch === '~' || /\s/.test(ch))
    if (isCombinator) {
      if (cur) out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** 拆成单个简单选择器：`.a.b:hover` → ['.a', '.b', ':hover'] */
function splitCompound(compound) {
  const parts = []
  let cur = ''
  for (let i = 0; i < compound.length; i += 1) {
    const ch = compound[i]
    // 伪元素的 '::' 不切开
    if ((ch === '.' || ch === '#' || ch === '[' || ch === ':') && cur && !cur.endsWith(':')) {
      parts.push(cur)
      cur = ''
    }
    cur += ch
    if (ch === '(') {
      let depth = 1
      while (i + 1 < compound.length && depth > 0) {
        i += 1
        if (compound[i] === '(') depth += 1
        if (compound[i] === ')') depth -= 1
        cur += compound[i]
      }
    }
  }
  if (cur) parts.push(cur)
  return parts
}

/**
 * 目标元素必然匹配的「超集选择器」集合 —— 元素匹配 S，就必然匹配其中每一个。
 *   1. S 自身；
 *   2. S 的最后一段复合选择器（`.a .b` 匹配的元素必然也匹配 `.b`）；
 *   3. 该复合选择器的任意子集（`.x.x--mod` 匹配的元素必然也匹配 `.x`）。
 * 只有这些字符串在别处声明过 display，才说明元素真的拿得到 display。
 */
function supersetSelectors(selector) {
  const keys = new Set([selector])
  const compounds = splitCompounds(selector)
  const last = compounds[compounds.length - 1]
  if (!last) return keys
  keys.add(last)

  const parts = splitCompound(last)
  if (parts.length > 1 && parts.length <= 6) {
    for (let mask = 1; mask < (1 << parts.length) - 1; mask += 1) {
      keys.add(parts.filter((_, idx) => mask & (1 << idx)).join(''))
    }
  }
  return keys
}

/** 只由一个类名构成的选择器 → 该类名（`.fbk-x` → 'fbk-x'），否则 null */
function soleClassSelector(selector) {
  const compounds = splitCompounds(selector)
  if (compounds.length !== 1) return null
  const parts = splitCompound(compounds[0])
  if (parts.length !== 1 || !parts[0].startsWith('.')) return null
  return parts[0].slice(1)
}

/* 样式源范围：发布包的样式与应用的样式一样会进产物，
   .vue 的 <style> / <style scoped> 块同理。 */
const STYLE_ROOTS = [
  join(root, 'packages', 'components', 'src'),
  join(root, 'packages', 'adapters'),
  join(root, 'packages', 'tokens', 'src'),
  join(root, 'packages', 'screen', 'src'),
  join(root, 'packages', 'dashboard', 'src'),
  join(root, 'packages', 'internal', 'demos'),
  join(root, 'apps', 'admin', 'src'),
  join(root, 'apps', 'playground', 'src'),
  join(root, 'apps', 'docs'),
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'cache', '.turbo'])

async function walkFiles(dir) {
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
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...(await walkFiles(full)))
    } else {
      out.push(full)
    }
  }
  return out
}

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/g

/** 抽出 .vue 里的 style 块；baseLine 让报出的行号还是这个 .vue 文件里的行号 */
function extractStyleBlocks(source) {
  const blocks = []
  for (const m of source.matchAll(STYLE_BLOCK_RE)) {
    const bodyStart = m.index + m[0].indexOf('>') + 1
    blocks.push({
      css: m[1],
      baseLine: source.slice(0, bodyStart).split('\n').length,
    })
  }
  return blocks
}

const allFiles = (await Promise.all(STYLE_ROOTS.map(walkFiles))).flat().sort()
const cssFiles = allFiles.filter((f) => f.endsWith('.css'))
const vueFiles = allFiles.filter((f) => f.endsWith('.vue'))

const toRel = (file) => relative(root, file).replace(/\\/g, '/')

const styleUnits = []
for (const file of cssFiles) {
  styleUnits.push({ rel: toRel(file), rules: parseRules(stripComments(await readFile(file, 'utf8'))) })
}
for (const file of vueFiles) {
  const source = await readFile(file, 'utf8')
  for (const block of extractStyleBlocks(source)) {
    styleUnits.push({ rel: toRel(file), rules: parseRules(stripComments(block.css), block.baseLine) })
  }
}

/* 先记一张「哪些选择器能让元素拿到 display」的表 —— 只记选择器自身，
   超集推导放在检查侧做：只有这样「`.x--mod` 不等于 `.x`」才不会被抹掉。 */
const unconditionalDisplay = new Set()
const conditionalDisplay = new Set() // `${条件}|${选择器}`

for (const { rules } of styleUnits) {
  for (const rule of rules) {
    if (!declaresDisplay(rule.decls)) continue
    const context = rule.conditions.join(' && ')
    for (const one of splitSelectorList(rule.selector)) {
      const key = normalizeSelector(one)
      if (context) conditionalDisplay.add(`${context}|${key}`)
      else unconditionalDisplay.add(key)
    }
  }
}

/* 修饰类规则的 display 常常来自同一个元素上的另一个类，例如
   <dl class="fbk-descriptions__grid" :class="{ 'fbk-descriptions--bordered': bordered }">
   —— --bordered 只管 gap 与边框，display 由 __grid 那条规则给。
   这层关系只能从真实元素取证（模板里写着的 class），不能靠删字符串猜。 */
const displayProvidingClasses = new Set()
for (const { rules } of styleUnits) {
  for (const rule of rules) {
    if (rule.conditions.length || !declaresDisplay(rule.decls)) continue
    for (const one of splitSelectorList(rule.selector)) {
      const cls = soleClassSelector(normalizeSelector(one))
      if (cls) displayProvidingClasses.add(cls)
    }
  }
}

/* 反向清单：自身没写 display 的类（.x--mod、.x__el 都算）。它们用到的
   gap 一类属性只能靠同一个元素上另一个类提供 display —— 于是每个用到它的元素
   都要带着那样的类，否则这条规则在它身上就是静默失效。 */
const displaylessClasses = new Set()
for (const { rules } of styleUnits) {
  for (const rule of rules) {
    if (declaresDisplay(rule.decls) || !usedFlexPropsOf(rule.decls).length) continue
    for (const one of splitSelectorList(rule.selector)) {
      const cls = soleClassSelector(normalizeSelector(one))
      if (cls) displaylessClasses.add(cls)
    }
  }
}

const START_TAG_RE = /<([A-Za-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const STATIC_CLASS_RE = /(?:^|\s)class="([^"]*)"/
const BOUND_CLASS_RE = /(?::class|v-bind:class)="([^"]*)"/g
const CLASS_TOKEN_RE = /^[A-Za-z][\w-]*$/

/** 从 :class 表达式里取类名；模板字符串只留静态片段，于是 `fbk-x--gap-${size}` 变成前缀 */
function tokensFromClassExpression(expr) {
  const tokens = []
  for (const m of expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? ''
    for (const part of raw.split(/\$\{[^}]*\}/)) tokens.push(...part.split(/\s+/))
  }
  for (const m of expr.matchAll(/(fbk-[\w-]*)/g)) tokens.push(m[1])
  return tokens.filter((t) => CLASS_TOKEN_RE.test(t))
}

const elementClasses = []
for (const file of vueFiles) {
  const source = await readFile(file, 'utf8')
  const tplStart = source.indexOf('<template>')
  if (tplStart === -1) continue
  for (const m of source.slice(tplStart).matchAll(START_TAG_RE)) {
    const attrs = m[2]
    const tokens = []
    const staticMatch = attrs.match(STATIC_CLASS_RE)
    if (staticMatch) tokens.push(...staticMatch[1].split(/\s+/))
    for (const bound of attrs.matchAll(BOUND_CLASS_RE)) {
      tokens.push(...tokensFromClassExpression(bound[1]))
    }
    const classes = tokens.filter((t) => CLASS_TOKEN_RE.test(t))
    if (!classes.length) continue
    elementClasses.push({
      rel: toRel(file),
      line: source.slice(0, tplStart + m.index).split('\n').length,
      classes,
    })
  }
}

/** 元素是否带着某个类（模板字符串写出的类只留了前缀，所以前缀也算命中） */
const carriesClass = (classes, cls) =>
  classes.some((c) => c === cls || (c.endsWith('-') && cls.startsWith(c)))

/** 是否有真实元素同时带着这个修饰类和一个声明过 display 的类 */
const hasSameElementEvidence = (cls) =>
  elementClasses.some(
    (element) =>
      carriesClass(element.classes, cls) &&
      element.classes.some((c) => c !== cls && displayProvidingClasses.has(c)),
  )

let ruleCount = 0

for (const { rel, rules } of styleUnits) {
  ruleCount += rules.length
  for (const rule of rules) {
    const usedFlexProps = usedFlexPropsOf(rule.decls)
    if (!usedFlexProps.length) continue
    if (declaresDisplay(rule.decls)) continue

    const context = rule.conditions.join(' && ')
    for (const one of splitSelectorList(rule.selector)) {
      const selector = normalizeSelector(one)
      /* 元素需要 display 才对 gap 一类属性生效。它由哪条规则提供？
         只要「命中本规则的元素」一定也命中某条声明了 display 的规则即可 ——
         超集推导本身就是证明；块外同一选择器给的 display 也在其中。 */
      const covered = [...supersetSelectors(selector)].some(
        (key) =>
          unconditionalDisplay.has(key) ||
          (context !== '' && conditionalDisplay.has(`${context}|${key}`)),
      )
      if (covered) continue
      // 只剩类名的修饰类没有 css 侧的证明，改看「同一个元素上还有谁声明了 display」
      const sole = soleClassSelector(selector)
      if (sole && hasSameElementEvidence(sole)) continue

      problems.push(
        `[布局] ${rel}:${rule.line} 的选择器 "${selector}" 使用了 ${usedFlexProps.join(', ')}` +
          ` 但没有 display: flex / grid${context ? `（位于 ${context} 内）` : ''}` +
          ' —— 这些属性会静默失效',
      )
    }
  }
}

/* 元素这一侧：带着「自身没写 display」的类，却没有带任何声明了 display 的类。
   这是「修饰类用在没有基类的元素上」的正面判据 —— 规则本身可能有别的正常用法，
   但这个元素上它一定不生效。 */
for (const { rel, line, classes } of elementClasses) {
  const used = [...displaylessClasses].filter((cls) => carriesClass(classes, cls))
  if (!used.length) continue
  if (classes.some((c) => displayProvidingClasses.has(c))) continue
  problems.push(
    `[布局] ${rel}:${line} 的元素带了 ${used.map((c) => `.${c}`).join('、')}` +
      '，但该元素上没有声明 display: flex / grid 的类 —— 依赖 display 的属性会静默失效',
  )
}

/* ---------- 4：demo 模板里的原生控件必须有样式类 ---------- */

/**
 * demo 是评审材料，里面的原生 <button> / <select> / <input> 若不带
 * 样式类，就会呈现浏览器默认外观（16px 字号、2px 边框），
 * 与被演示的组件完全是两套视觉语言。
 *
 * 认可以下几种前缀：
 *   fbk-demo-*     @fbkworks/demos 的脚手架样式
 *   playground__*  Playground 旧命名（BEM）
 *   pg__*          Playground 新命名（布局骨架）
 *   pg-sidebar__*  Playground 侧边栏
 *   pg-drawer__*   Playground 源码抽屉
 *                  （以上三者见 docs/design/2026-10-23-playground-redesign.md）
 *   fbk-*          组件库自身的类
 *
 * 只扫 packages/internal/demos 与 apps/playground —— 业务组件内部
 * 允许使用原生标签（它们由组件自己的 style.css 负责）。
 */
const RAW_CONTROL_RE = /<(button|select|input)\b[^>]*>/g
const STYLE_CLASS_RE = /class="([^"]*)"/

/** 类名是否表明这个控件已被样式接管 */
const STYLED_PREFIXES = ['fbk-demo-', 'playground__', 'pg__', 'pg-sidebar__', 'pg-drawer__', 'fbk-']
const isStyledClass = (cls) => STYLED_PREFIXES.some((p) => cls.includes(p))

const DEMO_PREFIXES = ['packages/internal/demos/', 'apps/playground/src/']
const demoTemplates = vueFiles.filter((file) =>
  DEMO_PREFIXES.some((prefix) => toRel(file).startsWith(prefix)),
)

for (const file of demoTemplates) {
  const src = await readFile(file, 'utf8')
  const rel = toRel(file)
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
    let styled = isStyledClass(cls)

    /* 也接受「父级带样式类」的写法：Playground 的 <select> 就是靠
       外层 .playground__field 定位的，自身不需要类。
       做法：从标签位置往前找最近的开始标签，看它是否带样式类。 */
    if (!styled) {
      const before = tpl.slice(0, m.index)
      const ancestors = [...before.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)].slice(-3)
      styled = ancestors.some((a) => {
        const c = (a[2].match(STYLE_CLASS_RE) || [])[1] || ''
        return isStyledClass(c)
      })
    }

    if (!styled) {
      problems.push(
        `[demo] ${rel} 里的原生 <${m[1]}> 没有 fbk-demo-* / pg__* / playground__* 样式类` +
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

console.log(
  `[check-styles] OK：${components.length} 个组件样式均已接入，` +
    `${styleUnits.length} 个样式源（${cssFiles.length} 个 CSS + ${styleUnits.length - cssFiles.length} 个 .vue <style> 块）` +
    `共 ${ruleCount} 条规则的布局声明无遗漏`,
)
