import { Buffer } from 'node:buffer'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import zlib from 'node:zlib'

/**
 * 生成公开包的体积基线（`size-baseline.json`），并打印一张可读的表。
 *
 * 为什么按**入口 + 可达性**而不是「包 dist 总量」：
 * `@fbkworks/components` 的 dist 是 10 个组件的总和（JS 91 KB / CSS 106 KB），
 * 但没有任何应用会一次性全量引入 —— 那个数字既不描述任何人付的代价，也会随无关组件
 * 增长而虚高。这里从每个 `exports` 入口沿**相对** import 走一遍（dist 是纯静态
 * 相对 import，没有动态加载、没有副作用注入），算出「引入这一个入口实际要拉多少」。
 *
 * 只对**原始字节**设阈，不卡 gzip：压缩结果随 zlib 版本浮动，
 * 拿它当门禁会在某些平台/Node 版本上假红。gzip 只在打印时给参考。
 *
 * 阈值：**比基线涨超 5% 且涨超 2 KB** 才算问题。
 * 两个条件都要满足，是为了同时放过「小基数上的小波动」和「大基数上的百分比噪声」。
 *
 * 新增入口不判红（它是新出现的，基线里没有可比对象）——它会出现在数据里，
 * 由人看；下一次 `pnpm gen:size-baseline` 把它写进基线。
 */

const root = resolve(import.meta.dirname, '..')
const baselineFile = join(root, 'size-baseline.json')
const checkOnly = process.argv.includes('--check')
const printOnly = process.argv.includes('--print')

const GROWTH_RATIO = 0.05
const GROWTH_FLOOR = 2 * 1024

/** 与 publish-all.mjs 的 discoverPublicPackages 同一规则 */
function discoverPublicPackages(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (existsSync(join(full, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(join(full, 'package.json'), 'utf8'))
      if (pkg.private !== true) out.push({ dir: full, pkg })
      continue
    }
    discoverPublicPackages(full, out)
  }
  return out
}

const STATIC_FROM = /\bfrom\s*['"]([^'"]+)['"]/g
const STATIC_SIDE_EFFECT = /^\s*import\s*['"]([^'"]+)['"]/gm
const CSS_IMPORT = /@import\s+(?:url\()?['"]([^'"]+)['"]/g

/** 只跟相对说明符；裸说明符（vue / element-plus / @fbkworks/*）是外部依赖，不计入 */
function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(fromFile, '..')
  const candidate = resolve(base, spec)
  for (const attempt of [candidate, candidate + '.mjs', join(candidate, 'index.mjs'), candidate + '.css']) {
    if (existsSync(attempt)) return attempt
  }
  return null
}

function collect(graph, file, seen) {
  if (seen.has(file) || !existsSync(file)) return
  seen.add(file)
  graph.push(file)
  const text = readFileSync(file, 'utf8')
  const specs = []
  for (const re of [STATIC_FROM, STATIC_SIDE_EFFECT, CSS_IMPORT]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) specs.push(m[1])
  }
  for (const spec of specs) {
    const next = resolveRelative(file, spec)
    if (next) collect(graph, next, seen)
  }
}

const size = (files) => {
  const bufs = files.map((f) => readFileSync(f))
  const raw = bufs.reduce((n, b) => n + b.length, 0)
  const gz = bufs.length ? zlib.gzipSync(Buffer.concat(bufs), { level: 9 }).length : 0
  return { raw, gz, count: files.length }
}

/** 从 package.json 的 exports 推出「入口 → (js 入口, css 入口)」 */
function collectEntries(pkgDir, pkg) {
  const exportsMap = pkg.exports ?? {}
  const jsEntries = new Map()
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (!target || typeof target !== 'object') continue
    const imp = target.import ?? target.default
    if (typeof imp === 'string' && imp.endsWith('.mjs')) jsEntries.set(subpath, join(pkgDir, imp))
  }

  const out = []
  const cssAlreadyCounted = new Set()
  for (const [subpath, jsFile] of [...jsEntries].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!existsSync(jsFile)) continue
    const jsGraph = []
    collect(jsGraph, jsFile, new Set())

    // 样式挂在 <subpath>/style.css 这种独立键上；只有真正的样式入口才跟 @import
    const cssKey = subpath === '.' ? './style.css' : subpath + '/style.css'
    const cssTarget = exportsMap[cssKey]
    const cssGraph = []
    if (typeof cssTarget === 'string') {
      const cssFile = join(pkgDir, cssTarget)
      if (existsSync(cssFile)) {
        cssAlreadyCounted.add(cssFile)
        collect(cssGraph, cssFile, new Set())
      }
    }

    const specifier = subpath === '.' ? pkg.name : pkg.name + subpath.slice(1)
    out.push({ specifier, js: size(jsGraph), css: size(cssGraph) })
  }

  // 纯样式入口（`@fbkworks/tokens/cyber.css` 这类）也是导出键，也要有数；
  // 已经作为某个 JS 入口的 style.css 统计过的不重复算一遍。
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (typeof target !== 'string' || !target.endsWith('.css')) continue
    const cssFile = join(pkgDir, target)
    if (!existsSync(cssFile) || cssAlreadyCounted.has(cssFile)) continue
    const cssGraph = []
    collect(cssGraph, cssFile, new Set())
    out.push({ specifier: pkg.name + subpath.slice(1), js: { raw: 0, gz: 0, count: 0 }, css: size(cssGraph) })
  }

  return out
}

const packages = discoverPublicPackages(join(root, 'packages')).sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
const measured = {}
const rows = []

for (const { dir, pkg } of packages) {
  if (!existsSync(join(dir, 'dist'))) {
    console.error(`[size] ${pkg.name} 没有 dist，请先 pnpm build`)
    process.exit(1)
  }
  for (const entry of collectEntries(dir, pkg)) {
    measured[entry.specifier] = { js: entry.js.raw, css: entry.css.raw, files: entry.js.count }
    rows.push({ ...entry })
  }
}

const sorted = {}
for (const key of Object.keys(measured).sort()) sorted[key] = measured[key]
const payload = {
  _note: '由 scripts/gen-size-baseline.mjs 生成，请勿手改。阈值：比基线涨超 5% 且涨超 2 KB 才红。有意增长时跑 pnpm gen:size-baseline，并把 diff 一起提交。',
  unit: 'bytes',
  entries: sorted,
}

const kb = (n) => (n / 1024).toFixed(1)

if (printOnly || !checkOnly) {
  console.log('')
  console.log('入口'.padEnd(46) + 'JS raw'.padStart(9) + 'JS gz'.padStart(9) + 'CSS raw'.padStart(9) + 'CSS gz'.padStart(9))
  for (const row of rows) {
    console.log(
      row.specifier.padEnd(46) +
        kb(row.js.raw).padStart(9) +
        kb(row.js.gz).padStart(9) +
        (row.css.count ? kb(row.css.raw) : '—').padStart(9) +
        (row.css.count ? kb(row.css.gz) : '—').padStart(9),
    )
  }
  console.log('')
}

if (printOnly) process.exit(0)

if (!checkOnly) {
  writeFileSync(baselineFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`[size] 已写入 size-baseline.json（${Object.keys(sorted).length} 个入口 / ${packages.length} 个包）`)
  process.exit(0)
}

if (!existsSync(baselineFile)) {
  console.error('[size] 缺少 size-baseline.json，先跑 pnpm gen:size-baseline')
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
const before = baseline.entries ?? {}
const failures = []
const fresh = []

const judged = (prev, cur) => {
  if (cur <= prev) return false
  const growth = cur - prev
  if (growth <= GROWTH_FLOOR) return false
  // 基线为 0（纯 CSS 入口没有 JS）时没有百分比可言：长出超过地板就算增长
  return prev === 0 ? true : growth / prev > GROWTH_RATIO
}

for (const [key, cur] of Object.entries(sorted)) {
  const prev = before[key]
  if (!prev) {
    fresh.push(key)
    continue
  }
  if (judged(prev.js, cur.js)) {
    failures.push(`  ${key} JS ${kb(prev.js)} → ${kb(cur.js)} KB（+${kb(cur.js - prev.js)} KB, +${(((cur.js - prev.js) / prev.js) * 100).toFixed(1)}%）`)
  }
  if (judged(prev.css, cur.css)) {
    failures.push(`  ${key} CSS ${kb(prev.css)} → ${kb(cur.css)} KB（+${kb(cur.css - prev.css)} KB）`)
  }
}

if (failures.length) {
  console.error('[size] 以下入口的体积超出阈值：')
  console.error(failures.join('\n'))
  console.error('[size] 若是有意为之：pnpm gen:size-baseline，并在提交里带上 size-baseline.json 的 diff。')
  process.exit(1)
}

const growthNote = fresh.length ? `；新增入口 ${fresh.length} 个未纳入比对（${fresh.slice(0, 3).join(', ')}${fresh.length > 3 ? '…' : ''}）` : ''
console.log(`[size] OK：${Object.keys(sorted).length} 个入口，均在「5% 且 2 KB」阈值内${growthNote}`)
