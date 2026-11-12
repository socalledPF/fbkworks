import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 从 @fbkworks/components 的导出与目录结构生成 resolver 的映射表。
 *
 * 为什么不再手写：resolver 的映射与 components 的导出一致性此前靠一份
 * **硬编码的名单**在测试里守，而那份名单与映射同源 —— 新增组件时若两处
 * 一起漏，测试照样全绿。实际发生过：P4-2 的 detail-drawer 就没进过映射，
 * 于是 <FbkDetailDrawer> 走自动导入会静默失效、也不注入样式。
 *
 * 推导规则：
 *   · 源码目录 src/<dir>/index.ts 存在         → 子路径就是 <dir>
 *   · `Fbk` + PascalCase(<dir>) 被 index.ts 导出 → 它是公开组件
 *   · src/<dir>/style.css 存在                → 带样式副作用
 *
 * 目录里写了组件但没从 index.ts 导出，会**报错而不是跳过** —— 那说明
 * 「目录有、公开 API 没有」，是需要人看一眼的不一致。
 */

const root = resolve(import.meta.dirname, '..')
const componentsDir = join(root, 'packages', 'components', 'src')
const componentsIndex = join(componentsDir, 'index.ts')
const outputFile = join(root, 'packages', 'resolver', 'src', 'generated-map.ts')
const checkOnly = process.argv.includes('--check')

/**
 * 比较前统一换行符。
 *
 * GitHub Actions 的 windows-latest 用 core.autocrlf 检出成 CRLF，
 * 而生成器产出的是 LF —— 直接按字节比较会在 CI 上判成「不一致」，
 * 本地（LF 工作树）却通过。换行符不是这里要校验的东西。
 */
const normalizeEol = (text) => text.replace(/\r\n/g, '\n')

const toPascal = (dir) =>
  dir
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

/* 只认**值导出**的组件名。
   以前是对整个 index.ts 跑 /\bFbk[A-Z][A-Za-z]* 的宽松正则：
   一旦导出 `export type { FbkProTableProps }` 这类类型（Fbk 前缀对类型同样自然），
   反向判定就会报「找不到对应源码目录」—— 假红会逼人改名或建假目录。
   这里按语句切分，跳过 export type 分支。 */
const componentsIndexSource = readFileSync(componentsIndex, 'utf8')
const valueExportNames = new Set()
for (const statement of componentsIndexSource.split(/\n(?=export )/)) {
  if (/^export\s+type\b/.test(statement.trim())) continue
  for (const match of statement.matchAll(/\bFbk[A-Z][A-Za-z]*/g)) valueExportNames.add(match[0])
}
const exportedFbk = valueExportNames

const entries = []
const problems = []

for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const dir = entry.name
  if (!existsSync(join(componentsDir, dir, 'index.ts'))) continue

  const name = `Fbk${toPascal(dir)}`
  if (!exportedFbk.has(name)) {
    problems.push(`src/${dir}/index.ts 存在，但 ${name} 没有从 components 的 index.ts 导出`)
    continue
  }

  entries.push({
    name,
    subpath: dir,
    style: existsSync(join(componentsDir, dir, 'style.css'))
      ? `@fbkworks/components/${dir}/style.css`
      : undefined,
  })
}

// 反向：导出了 Fbk* 但没有对应目录
const dirNames = new Set(entries.map((e) => e.name))
for (const name of exportedFbk) {
  if (!dirNames.has(name)) problems.push(`${name} 从 components 导出了，但找不到对应的源码目录`)
}

if (problems.length) {
  for (const p of problems) console.error(`[gen-resolver-map] ${p}`)
  console.error(`\n[gen-resolver-map] 共 ${problems.length} 处不一致，未生成`)
  process.exit(1)
}

entries.sort((a, b) => a.name.localeCompare(b.name))

const lines = entries.map((e) => {
  const style = e.style === undefined ? 'undefined' : `'${e.style}'`
  return `  ${e.name}: { subpath: '${e.subpath}', style: ${style} },`
})

const generated = `/**
 * 由 \`scripts/gen-resolver-map.mjs\` 生成，请勿手改。
 * 改这个文件等于在改一份会被覆盖的副本 —— 要加组件就去加组件目录。
 *
 * 之所以把映射落成文件而不是运行时读文件系统：resolver 是发布包，
 * 不能依赖构建期的目录结构。
 */

export interface ResolverEntry {
  /** \`@fbkworks/components\` 之后的子路径 */
  subpath: string
  /** 样式副作用入口；组件没有自己的 style.css 时为 undefined */
  style: string | undefined
}

export const componentMap: Record<string, ResolverEntry> = {
${lines.join('\n')}
}
`

if (checkOnly) {
  const current = existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : ''
  if (normalizeEol(current) !== normalizeEol(generated)) {
    console.error('[gen-resolver-map] 生成结果与现有文件不一致，请运行 pnpm gen:resolver-map')
    process.exit(1)
  }
  console.log(`[gen-resolver-map] 一致：${entries.length} 个组件`)
  process.exit(0)
}

writeFileSync(outputFile, generated)
console.log(`[gen-resolver-map] 已生成 ${entries.length} 个组件 → packages/resolver/src/generated-map.ts`)
for (const e of entries) {
  console.log(`  ${e.name.padEnd(20)} / ${e.subpath.padEnd(16)} ${e.style ? '有样式' : '无样式'}`)
}
