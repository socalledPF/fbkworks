import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * 架构红线：UI 库只能在 `packages/adapters/**` 里出现；发布包禁止 13 个一类运行时依赖。
 *
 * ## 为什么这道门是「静态扫描」而不是依赖图
 *
 * `lint:deps` 里本来就有 `ui-libs-only-in-adapters` 和 `no-business-runtime-deps` 两条规则，
 * 但实测它们**对裸 import 不生效**：
 *
 *   · 往 `apps/playground/src/__probe.ts` 写 `import { ElButton } from 'element-plus'`，
 *     `depcruise packages apps` 报 0 违规；
 *   · 探针文件确实在依赖图里，但 `element-plus` 这条边要么没被记录，要么 `resolved`
 *     不等于任何 `path` 谓词能匹配的形态（`dayjs` 那条边是 `couldNotResolve: true`，
 *     而 `path` 谓词对它的匹配行为在不同 `doNotFollow` 配置下并不稳定）。
 *
 * 试过把 `to` 写成数组表达 OR、也试过加 `module` 谓词 —— 前者让配置校验直接失败
 * （该版本 schema 要求 `to` 是单个对象），后者同样不被接受。
 *
 * 所以这里退回到最不会骗人的办法：**逐文件读源码找 import 说明符**。
 * 它不依赖解析器，也就没有「解析不到所以不报」这条路。
 *
 * 已复核的边界：这条门只看源码；`dist` 产物由 `check:runtime-deps` 与
 * `check:surface` 负责。两者合起来才等于「发布出去的东西是干净的」。
 */

const root = resolve(import.meta.dirname, '..')

const UI_LIBS = /^(element-plus|vant|naive-ui)(\/|$)/
const BANNED_RUNTIME = /^(axios|ky|ofetch|superagent|vue-router|pinia|vuex|vue-i18n|dayjs|moment|lodash|ramda|date-fns)(\/|$)/

/** 说明符出现在这些位置都算引用 */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // .vue / .css 里的 @import 也会带出 UI 库样式
  /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
]

const SOURCE_EXT = /\.(ts|tsx|mts|cts|vue|js|jsx|mjs)$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (SOURCE_EXT.test(entry.name)) out.push(full)
  }
  return out
}

const roots = [
  join(root, 'packages'),
  join(root, 'apps'),
].filter((dir) => {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
})

const problems = []
let scanned = 0

for (const start of roots) {
  for (const file of walk(start)) {
    const rel = relative(root, file).replace(/\\/g, '/')
    const text = readFileSync(file, 'utf8')
    scanned++

    for (const pattern of SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text))) {
        const spec = match[1]
        const line = text.slice(0, match.index).split('\n').length

        /* 只管**发布包源码**：apps/ 下的演示应用本来就要直接用 UI 库
           （侧边栏用 el-select、demo 里演示原生控件），ESLint 对它们也有既有豁免。
           红线是「库代码不得依赖具体 UI 库」，不是「应用不许用」。 */
        if (UI_LIBS.test(spec) && rel.startsWith('packages/') && !rel.startsWith('packages/adapters/')) {
          problems.push(`${rel}:${line} 引用了 UI 库「${spec}」—— 只允许出现在 packages/adapters/**`)
        }
        if (BANNED_RUNTIME.test(spec) && rel.startsWith('packages/')) {
          problems.push(`${rel}:${line} 引用了被禁的一类运行时依赖「${spec}」`)
        }
      }
    }
  }
}

if (scanned === 0) {
  console.error('[ui-imports] 一个源文件都没扫到 —— 路径算错了，这条门禁等于没跑')
  process.exit(1)
}

if (problems.length) {
  console.error(`[ui-imports] 发现 ${problems.length} 处架构违规：`)
  for (const problem of problems) console.error(`  · ${problem}`)
  process.exit(1)
}

console.log(`[ui-imports] OK：${scanned} 个源文件，UI 库只出现在 adapters，发布包无被禁运行时依赖`)
