import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * 公开 d.ts 不得泄漏 UI 库类型。
 *
 * 曾经只扫 `packages/components/dist` —— 12 个发布包里只罩住 1 个，其余 11 个
 * （data / shared / tokens / adapter-core / chart-core / dashboard / screen / resolver）
 * 完全没被这道门约束，而它们同样是 public。判据的覆盖面必须等于它声称的范围，
 * 否则「全绿」只是「大部分地方没看」。
 *
 * 三个 UI 适配器排除在外：它们的公开类型里出现 UI 库类型是设计如此（原语就是包了一层）。
 * 它们的存在性由 `check:runtime-deps`（产物依赖）和一致性套件负责。
 */

const root = resolve(import.meta.dirname, '..')
const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage'])

/** 找发布包：目录里有 package.json 且 private !== true */
function collectPackages(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    const pkgFile = join(full, 'package.json')
    if (existsSync(pkgFile)) {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
      const isUiAdapter = /^@fbkworks\/adapter-(element-plus|vant|naive-ui)$/.test(pkg.name ?? '')
      if (pkg.private !== true && !isUiAdapter) {
        out.push({ name: pkg.name, dist: join(full, 'dist') })
      }
      continue
    }
    collectPackages(full, out)
  }
  return out
}

function walkDts(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkDts(full, out)
    else if (entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

const banned = [
  { re: /from ['"]element-plus(\/[^'"]*)?['"]/, label: 'element-plus' },
  { re: /from ['"]vant(\/[^'"]*)?['"]/, label: 'vant' },
  { re: /from ['"]naive-ui(\/[^'"]*)?['"]/, label: 'naive-ui' },
  // 类型位置还有第二种写法：`type X = import('element-plus').Foo`。
  // 只匹配 `from '...'` 会漏掉它，而 vite-plugin-dts 对推断类型常产出这种形态。
  { re: /import\(\s*['"]element-plus(\/[^'"]*)?['"]\s*\)/, label: 'element-plus（import() 类型）' },
  { re: /import\(\s*['"]vant(\/[^'"]*)?['"]\s*\)/, label: 'vant（import() 类型）' },
  { re: /import\(\s*['"]naive-ui(\/[^'"]*)?['"]\s*\)/, label: 'naive-ui（import() 类型）' },
  {
    re: /from ['"]@fbkworks\/adapter-(?!core)[^'"]*['"]/,
    label: '具体适配器实现（components 只能依赖 @fbkworks/adapter-core）',
  },
]

const packages = collectPackages(join(root, 'packages'))
if (packages.length === 0) {
  console.error('[type-surface] 没找到任何发布包 —— 路径算错了，这道门等于没跑')
  process.exit(1)
}

let failures = 0
let scannedFiles = 0
const missingDist = []

for (const pkg of packages) {
  const files = walkDts(pkg.dist)
  if (files.length === 0) {
    missingDist.push(pkg.name)
    continue
  }
  for (const file of files) {
    scannedFiles += 1
    const text = readFileSync(file, 'utf8')
    for (const { re, label } of banned) {
      if (re.test(text)) {
        console.error(`[type-surface] ${relative(root, file).replace(/\\/g, '/')} 泄漏了 ${label}`)
        failures += 1
      }
    }
  }
}

if (missingDist.length) {
  console.error(
    `[type-surface] 这些发布包没有 dist 产物：${missingDist.join('、')}` +
      '\n  先执行 pnpm build（verify 里 build 排在它前面）。',
  )
  process.exit(1)
}

if (failures > 0) {
  console.error(`[type-surface] 发现 ${failures} 处类型泄漏`)
  process.exit(1)
}
console.log(
  `[type-surface] OK：${packages.length} 个发布包 / ${scannedFiles} 个 d.ts，未泄漏 UI 库类型（已排除 3 个 UI 适配器）`,
)
