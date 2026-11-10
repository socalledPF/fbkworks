import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 生成组件样式的**聚合入口**（`packages/components/src/styles/index.css`）。
 *
 * 为什么不再手写：新增组件时漏登记 → 引用聚合入口的应用（admin / docs / playground）
 * 拿不到该组件样式，而**不报错**。这正是 style-guide 里记录的原始事故：
 * FormModal 底部两个按钮紧贴、gap 完全无效，测试全绿、类型全对。
 * `check:styles` 能查出漏登记，但它只在 `pnpm verify` 里跑；生成则让「漏」不存在。
 *
 * 只生成这一份。以前它还往 `apps/playground/src/styles.ts` 里写一段逐个组件的
 * 子路径 import，而 `check-style-entries` 的判据恰恰是「引子路径 ≠ 接入整个组件库，
 * 只认聚合入口」—— 两个检查互相顶，playground 只好同时背着两套写法，
 * 同一份 CSS 还被重复引入。现在唯一真相是：**聚合入口必须完整**，应用只认聚合入口。
 *
 * 排序按目录名。已验证「组件之间没有级联竞争」：9 个组件共 123 个选择器，
 * 跨组件重复 0 个，因此组件样式文件的先后不影响最终样式。
 */

const root = resolve(import.meta.dirname, '..')
const componentsDir = join(root, 'packages', 'components', 'src')
const indexFile = join(componentsDir, 'styles', 'index.css')
const checkOnly = process.argv.includes('--check')

/**
 * 比较前统一换行符。
 *
 * GitHub Actions 的 windows-latest 用 core.autocrlf 检出成 CRLF，
 * 而生成器产出的是 LF —— 直接按字节比较会在 CI 上判成「不一致」，
 * 本地（LF 工作树）却通过。换行符不是这里要校验的东西。
 */
const normalizeEol = (text) => text.replace(/\r\n/g, '\n')

/** 有 style.css 的组件目录，按名字排序 */
const components = readdirSync(componentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(componentsDir, e.name, 'style.css')))
  .map((e) => e.name)
  .sort()

if (components.length === 0) {
  console.error('[gen-style-entries] 没有扫描到任何组件 style.css，拒绝生成空清单')
  process.exit(1)
}

const indexContent = `/**
 * 由 \`scripts/gen-style-entries.mjs\` 生成，请勿手改。
 * 新增组件后运行 \`pnpm gen:style-index\`。
 *
 * 顺序按目录名。组件的样式各自带 \`.fbk-<name>\` 前缀，跨组件没有重复选择器，
 * 因此这个顺序不影响最终样式 —— 它只是为了让生成结果确定、可 diff。
 */

@import '@fbkworks/tokens/css';
${components.map((name) => `@import '../${name}/style.css';`).join('\n')}
`

if (checkOnly) {
  const stale =
    !existsSync(indexFile) || normalizeEol(readFileSync(indexFile, 'utf8')) !== normalizeEol(indexContent)
  if (stale) {
    console.error(`[gen-style-entries] ${indexFile} 与生成结果不一致，请运行 pnpm gen:style-index`)
    process.exit(1)
  }
  console.log(`[gen-style-entries] 一致：${components.length} 个组件`)
  process.exit(0)
}

writeFileSync(indexFile, indexContent)
console.log(`[gen-style-entries] 已生成 ${components.length} 个组件 → packages/components/src/styles/index.css`)
for (const name of components) console.log(`  · ${name}`)
