#!/usr/bin/env node
/**
 * 样式入口完整性检查。
 *
 * ## 为什么需要它
 *
 * 新增一个包（或包里的 `style.css`）后，必须手工把它加进若干个入口文件。
 * 漏掉任何一处都是**静默失效**：构建通过、类型正确、单测全绿，
 * 但页面上样式没生效 —— 这个坑在本项目里重复出现过至少 3 次：
 *   · form-modal / crud-page / result 的 style.css 没接入 → footer 按钮间距为 0
 *   · chart-core/style.css 从未被引入 → 图表容器高度为 0，canvas 全空白
 *   · admin 漏了 layout.css → 侧边栏塌成裸文本
 *
 * `check:styles` 只校验 `packages/components/styles/index.css` 一处，
 * 覆盖不到 playground / docs / admin。
 *
 * ## 检查什么
 *
 * 1. 每个发布包的 `src/style.css` 都出现在**组件库聚合入口**里
 *    （`packages/components/src/styles/index.css` 或各自的 `styles/index.css`）
 * 2. 三个应用（playground / docs / admin）用到的每个 `@fbkworks/*` 包，
 *    其 style.css 都被引入（直接或通过聚合入口间接引入）
 * 3. 入口文件里引用的路径真实存在（防手滑写错）
 */

import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** 有样式的发布包 → 它的 style.css 路径 */
const PACKAGES_WITH_STYLE = {
  '@fbkworks/tokens': ['packages/tokens/src/css/tokens.css', 'packages/tokens/src/css/dark.css'],
  '@fbkworks/adapter-element-plus': ['packages/adapters/element-plus/src/style.css'],
  '@fbkworks/adapter-vant': ['packages/adapters/vant/src/style.css'],
  '@fbkworks/adapter-naive-ui': ['packages/adapters/naive-ui/src/style.css'],
  '@fbkworks/components': ['packages/components/src/styles/index.css'],
  '@fbkworks/chart-core': ['packages/chart-core/src/style.css'],
  '@fbkworks/dashboard': ['packages/dashboard/src/style.css'],
  '@fbkworks/screen': ['packages/screen/src/style.css'],
  '@fbkworks/demos': ['packages/internal/demos/src/demo.css'],
}

/**
 * 应用入口：每个应用**使用**哪些包，就必须引入对应的样式。
 *
 * `uses` 是应用 package.json 里真实声明依赖的 @fbkworks 包；
 * 这里手工列出，是因为不是所有依赖都需要样式
 * （如 @fbkworks/shared / @fbkworks/data 是纯逻辑，无样式）。
 */
const APP_ENTRIES = [
  {
    name: 'playground',
    file: 'apps/playground/src/styles.ts',
    // 全部纳入：playground 评审全部组件，也是唯一同时挂三个适配器的应用。
    // 不要按包名写排除式 —— 混用 && / || 的排除式曾把 vant / naive-ui 静默排除在外。
    requires: Object.keys(PACKAGES_WITH_STYLE),
  },
  {
    name: 'docs',
    file: 'apps/docs/.vitepress/theme/index.ts',
    // 文档站渲染 demo，需要 components + demos；图表 demo 需要 chart-core
    requires: ['@fbkworks/components', '@fbkworks/chart-core', '@fbkworks/dashboard', '@fbkworks/screen', '@fbkworks/demos'],
  },
  {
    name: 'admin',
    file: 'apps/admin/src/styles/index.ts',
    requires: ['@fbkworks/components', '@fbkworks/chart-core', '@fbkworks/dashboard'],
  },
]

let failures = 0
const report = (msg) => {
  console.error(`[style-entries] ${msg}`)
  failures += 1
}

/** 从入口文件里提取所有 @fbkworks 样式引用（import 语句与 @import 都算） */
async function collectStyleRefs(file) {
  const abs = resolve(root, file)
  if (!existsSync(abs)) {
    report(`入口文件不存在：${file}`)
    return null
  }
  const source = await readFile(abs, 'utf8')
  const refs = new Set()

  // 两种写法都要采集：
  //   import '@fbkworks/x/style.css'   —— 带 .css 后缀
  //   import '@fbkworks/tokens/css'    —— tokens 的聚合入口不带后缀
  for (const m of source.matchAll(/['"](@fbkworks\/[^'"]*\.css)['"]/g)) {
    refs.add(m[1])
  }
  for (const m of source.matchAll(/['"](@fbkworks\/tokens\/css)['"]/g)) {
    refs.add(m[1])
  }
  // components 用的相对路径：@import '../pro-table/style.css'
  for (const m of source.matchAll(/['"]\.\.\/([a-z-]+)\/style\.css['"]/g)) {
    refs.add(`@fbkworks/components/${m[1]}/style.css`)
  }
  return refs
}

/**
 * 每个包对外暴露的聚合样式入口。
 *
 * 只认聚合入口本身（含它内部的路径），子组件样式不算：
 * 引一个 `@fbkworks/components/pro-table/style.css` ≠ 接入了整个组件库 ——
 * 「任意子路径都算覆盖」正是 exports 缺 4 个组件却长期没人发现的原因。
 *
 * components 有两个指向同一份完整样式表的等价入口：
 *   · `@fbkworks/components/styles/index.css` 源码聚合，逐条 @import 各子组件
 *   · `@fbkworks/components/style.css`        构建产物，由 bundle-css.mjs 把上面那份拼成单文件
 */
const AGGREGATE_STYLE_ENTRIES = {
  '@fbkworks/tokens': ['@fbkworks/tokens/css'],
  '@fbkworks/components': ['@fbkworks/components/styles', '@fbkworks/components/style.css'],
}

/** 包的聚合样式入口候选（默认就是 <pkg>/style.css） */
const styleEntriesFor = (pkg) => AGGREGATE_STYLE_ENTRIES[pkg] ?? [`${pkg}/style.css`]

/** 报错文案里用作「期望引入的入口」 */
const styleEntryFor = (pkg) => styleEntriesFor(pkg)[0]

/** ref 是否命中了该包的聚合样式入口 */
const isAggregateRef = (pkg, ref) =>
  styleEntriesFor(pkg).some((entry) => ref === entry || ref.startsWith(`${entry}/`))

/** 某个包是否已被引入：必须命中聚合入口本身，而不是任意子路径 */
function isCovered(pkg, refs) {
  for (const ref of refs) {
    if (isAggregateRef(pkg, ref)) return true
  }
  return false
}

/* ---------- 检查 1：每个发布包的 style.css 真实存在 ---------- */
for (const [pkg, files] of Object.entries(PACKAGES_WITH_STYLE)) {
  for (const f of files) {
    if (!existsSync(resolve(root, f))) {
      report(`${pkg} 声明的样式文件不存在：${f}`)
    }
  }
}

/* ---------- 检查 2：包内的零散 style.css 都进了聚合入口 ---------- */
const componentDir = resolve(root, 'packages/components/src')
const componentEntry = await readFile(join(componentDir, 'styles/index.css'), 'utf8')
for (const entry of await readdir(componentDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const styleFile = join(componentDir, entry.name, 'style.css')
  if (!existsSync(styleFile)) continue
  if (!componentEntry.includes(`../${entry.name}/style.css`)) {
    report(`packages/components/src/${entry.name}/style.css 未注册到 styles/index.css`)
  }
}

/* ---------- 检查 3：三个应用引入各自需要的包样式 ---------- */
for (const app of APP_ENTRIES) {
  const refs = await collectStyleRefs(app.file)
  if (!refs) continue

  for (const pkg of app.requires) {
    if (!isCovered(pkg, refs)) {
      report(
        `${app.name} 缺少 ${pkg} 的样式引入（期望 ${styleEntryFor(pkg)} 出现在 ${app.file}）`,
      )
    }
  }
}

/* ---------- 检查 4：入口引用的路径真实存在 ---------- */
for (const app of APP_ENTRIES) {
  const refs = await collectStyleRefs(app.file)
  if (!refs) continue
  for (const ref of refs) {
    // @fbkworks/components/pro-table/style.css → packages/components/src/pro-table/style.css
    if (ref.startsWith('@fbkworks/components/') && !isAggregateRef('@fbkworks/components', ref)) {
      const rel = ref.replace('@fbkworks/components/', '')
      const abs = resolve(root, 'packages/components/src', rel)
      if (!existsSync(abs)) report(`${app.name} 引用了不存在的路径：${ref}`)
    }
  }
}

if (failures > 0) {
  console.error(
    `\n[style-entries] 失败：${failures} 处问题。` +
      `\n  样式漏接是静默失效 —— 构建和单测都不会报错，只有真实浏览器能发现。`,
  )
  process.exit(1)
}

console.log(
  `[style-entries] OK：${Object.keys(PACKAGES_WITH_STYLE).length} 个包 / ${APP_ENTRIES.length} 个应用入口，样式接入完整`,
)
