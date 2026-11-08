import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 生成 `packages/components` 的两处手写清单：`package.json` 的 `exports` 与
 * `vite.config.ts` 的 `entries`。
 *
 * 为什么生成：这两处是同一个事实的两次抄写（哪些组件有子路径入口），而且**错了不报错** ——
 * 漏一个 entry，构建产物就少一个子路径；漏一个 exports，消费者 `import '@fbkworks/components/x'`
 * 直接解析失败，或者更糟：解析到构建产物里的旧文件。这个仓库里「同一事实抄两份」已经
 * 制造过两次事故（样式入口清单、resolver 映射）。
 *
 * 判据只有一条：`src/<name>/index.ts` 存在 → 该组件有子路径入口；
 * 同目录再有 `style.css` → 追加 `./<name>/style.css`。
 *
 * 用法：无参数 = 重写；`--check` = 只比对（门禁用）。
 */

const root = resolve(import.meta.dirname, '..')
const pkgDir = join(root, 'packages', 'components')
const srcDir = join(pkgDir, 'src')
const pkgFile = join(pkgDir, 'package.json')
const viteFile = join(pkgDir, 'vite.config.ts')
const checkOnly = process.argv.includes('--check')
const normalizeEol = (text) => text.replace(/\r\n/g, '\n')

const START = '  // <generated:entries>'
const END = '  // </generated:entries>'

const components = readdirSync(srcDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(srcDir, entry.name, 'index.ts')))
  .map((entry) => entry.name)
  .sort()

if (components.length === 0) {
  console.error('[package-entries] 没有扫描到任何组件入口，拒绝生成空清单')
  process.exit(1)
}

/* ---------- vite entries ---------- */
const entryLines = [
  START,
  '  entries: {',
  "    index: 'src/index.ts',",
  ...components.map((name) => `    '${name}/index': 'src/${name}/index.ts',`),
  '  },',
  END,
].join('\n')

/* ---------- package.json exports ---------- */
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
const exportsMap = {
  '.': { types: './dist/index.d.ts', import: './dist/index.mjs' },
}
for (const name of components) {
  exportsMap[`./${name}`] = {
    types: `./dist/${name}/index.d.ts`,
    import: `./dist/${name}/index.mjs`,
  }
  if (existsSync(join(srcDir, name, 'style.css'))) {
    exportsMap[`./${name}/style.css`] = `./dist/${name}/style.css`
  }
}
// 聚合样式入口是构建产物（bundle-css 生成），与组件目录无关，但它也是对外契约
exportsMap['./styles/index.css'] = './dist/styles/index.css'
exportsMap['./style.css'] = './dist/style.css'
exportsMap['./package.json'] = './package.json'
pkg.exports = exportsMap
const pkgText = JSON.stringify(pkg, null, 2) + '\n'

/* ---------- 写入或比对 ---------- */
const currentVite = normalizeEol(readFileSync(viteFile, 'utf8'))
const startAt = currentVite.indexOf(START)
const endAt = currentVite.indexOf(END)
if (startAt < 0 || endAt < startAt) {
  console.error('[package-entries] vite.config.ts 里找不到 <generated:entries> 标记块')
  process.exit(1)
}
const nextVite =
  currentVite.slice(0, startAt) + entryLines + currentVite.slice(endAt + END.length)

if (!checkOnly) {
  writeFileSync(viteFile, nextVite, 'utf8')
  writeFileSync(pkgFile, pkgText, 'utf8')
  console.log(
    `[package-entries] 已生成：${components.length} 个组件入口 / ${Object.keys(exportsMap).length} 个 exports 键`,
  )
  process.exit(0)
}

const failures = []
if (currentVite !== nextVite) failures.push('packages/components/vite.config.ts 的 entries')
if (normalizeEol(readFileSync(pkgFile, 'utf8')) !== pkgText) {
  failures.push('packages/components/package.json 的 exports')
}
if (failures.length) {
  console.error('[package-entries] 以下生成结果与源头不一致：')
  for (const failure of failures) console.error(`  · ${failure}`)
  console.error('[package-entries] 运行 pnpm gen:package-entries 重新生成')
  process.exit(1)
}
console.log(
  `[package-entries] OK：${components.length} 个组件入口 / ${Object.keys(exportsMap).length} 个 exports 键与组件目录一致`,
)
