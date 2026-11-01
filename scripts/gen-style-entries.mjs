import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 生成组件样式的两份入口清单。
 *
 * 为什么不再手写：`styles/index.css` 与 `apps/playground/src/styles.ts` 各维护一份
 * 「哪些组件有 style.css」的清单。新增组件时漏登记 → 引用聚合入口的应用
 * （admin / docs / playground 全部三个）拿不到该组件样式，而**不报错**。
 * 这正是 style-guide 里记录的原始事故：FormModal 底部两个按钮紧贴、
 * gap 完全无效，测试全绿、类型全对。
 *
 * `check:styles` 现在已经能查出漏登记，但它只在 `pnpm verify` 里跑 ——
 * `pnpm dev` 与 `pnpm build` 都不跑。也就是说本地开发时漏了仍然静默。
 * 生成则让「漏」这个状态根本不存在。
 *
 * 排序按目录名。已验证「组件之间没有级联竞争」：9 个组件共 123 个选择器，
 * 跨组件重复 0 个，因此组件样式文件的先后不影响最终样式。
 */

const root = resolve(import.meta.dirname, '..')
const componentsDir = join(root, 'packages', 'components', 'src')
const indexFile = join(componentsDir, 'styles', 'index.css')
const playgroundFile = join(root, 'apps', 'playground', 'src', 'styles.ts')
const checkOnly = process.argv.includes('--check')

const START = '// <generated:components>'
const END = '// </generated:components>'

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

const playgroundBlock = [
  START,
  ...components.map((name) => `import '@fbkworks/components/${name}/style.css'`),
  END,
].join('\n')

const playgroundSource = readFileSync(playgroundFile, 'utf8')
const startAt = playgroundSource.indexOf(START)
const endAt = playgroundSource.indexOf(END)
if (startAt === -1 || endAt === -1 || endAt < startAt) {
  console.error(`[gen-style-entries] ${playgroundFile} 里找不到 ${START} / ${END} 标记`)
  process.exit(1)
}
const playgroundNext =
  playgroundSource.slice(0, startAt) + playgroundBlock + playgroundSource.slice(endAt + END.length)

if (checkOnly) {
  const stale = []
  if (!existsSync(indexFile) || readFileSync(indexFile, 'utf8') !== indexContent) stale.push(indexFile)
  if (playgroundNext !== playgroundSource) stale.push(playgroundFile)

  if (stale.length) {
    console.error('[gen-style-entries] 以下文件与生成结果不一致，请运行 pnpm gen:style-index：')
    for (const f of stale) console.error(`  ${f.replace(root + '\\', '')}`)
    process.exit(1)
  }
  console.log(`[gen-style-entries] 一致：${components.length} 个组件`)
  process.exit(0)
}

writeFileSync(indexFile, indexContent)
writeFileSync(playgroundFile, playgroundNext)
console.log(`[gen-style-entries] 已生成 ${components.length} 个组件 →`)
console.log('  packages/components/src/styles/index.css')
console.log('  apps/playground/src/styles.ts（generated:components 区间）')
for (const name of components) console.log(`  · ${name}`)
