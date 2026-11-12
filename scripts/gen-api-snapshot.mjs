import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

/**
 * 生成公开类型 API 基线（`api-snapshot/*.json`）。
 *
 * 为什么需要它：`check:surface` 只查「有没有泄漏 UI 库类型」，`check:types`（attw）只查
 * 发布形态能不能被解析。**没有任何门禁会拦住「把 ProTableProps 里的一个 prop 改名/删掉」**
 * —— 那对消费者是破坏性变更，对我们却是一片绿。
 *
 * 快照的是 **类型声明**，不是运行时：props/expose 在 d.ts 里就是具名类型
 * （`ProTableProps` / `ProTableExpose`），改它会在这里留下 diff。
 *
 * 两个刻意的排除，都不是偷懒：
 *
 *   1. **三个 UI 适配器不进快照**。它们的 d.ts 嵌了 element-plus / vant / naive-ui 的
 *      类型（`root-provider.d.ts`、`theme.d.ts` 实测如此），UI 库一升版本我们的基线就会
 *      假红。适配器的契约由 `adapter-conformance` 与浏览器脚本在运行时覆盖。
 *
 *   2. **.vue 组件的值声明只记名字**。它的 d.ts 是 vue-tsc 生成的 `__VLS_*` 签名，
 *      换一个 TS 版本就变，写进基线等于给自己埋噪声。所以「组件还在、叫什么」被覆盖，
 *      「它的 props 长什么样」由它导出的 `XxxProps` 类型覆盖 —— 前提是那个包导出了该类型。
 *
 * 用法：无参数 = 重新生成；`--check` = 只比对（门禁用）。
 */

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'api-snapshot')
const checkOnly = process.argv.includes('--check')

/** 只排除 UI 适配器；adapter-core 是契约层，必须进快照 */
const UI_ADAPTERS = new Set([
  '@fbkworks/adapter-element-plus',
  '@fbkworks/adapter-vant',
  '@fbkworks/adapter-naive-ui',
])

const norm = (p) => p.replace(/\\/g, '/')

/** 与 publish-all.mjs 的 discoverPublicPackages 同一规则：有 package.json 且不是 private */
function discoverPublicPackages(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (existsSync(join(full, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(join(full, 'package.json'), 'utf8'))
      if (pkg.private !== true) out.push({ dir: full, relDir: norm(relative(root, full)), pkg })
      continue
    }
    discoverPublicPackages(full, out)
  }
  return out
}

/** exports 里所有指向 .d.ts 的目标；CSS / package.json 这类字符串课目自然被滤掉 */
function collectTypeEntries(pkgDir, pkg) {
  const entries = []
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (!target || typeof target !== 'object') continue
    const types = target.types
    if (typeof types !== 'string' || !types.endsWith('.d.ts')) continue
    const abs = join(pkgDir, types)
    if (!existsSync(abs)) {
      console.error(`[api-snapshot] 找不到 ${norm(relative(root, abs))}，请先执行 pnpm build`)
      process.exit(1)
    }
    entries.push({ subpath, file: abs })
  }
  return entries.sort((a, b) => a.subpath.localeCompare(b.subpath))
}

/**
 * 去掉注释。必须是状态机而不是正则：类型里会出现 `'a//b'` 这类字符串字面量，
 * 正则删注释会把它们截断成语法垃圾。
 */
function stripComments(text) {
  let out = ''
  let i = 0
  let quote = null
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/** 行级归一：去公共缩进、去行尾空白、压缩空行 —— 让 diff 只反映真实变化 */
function normalize(text) {
  const lines = stripComments(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/, ''))
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length)
  const common = indents.length ? Math.min(...indents) : 0

  // 空行一律丢掉：它们只是被删掉的 JSDoc 留下的残迹。留着的话，
  // 「改一段注释」会让快照出现一条与 API 无关的 diff —— 那就成了噪声，不是保护。
  return lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.slice(common))
    .join('\n')
}

const DECL_KIND = new Map([
  [ts.SyntaxKind.InterfaceDeclaration, 'interface'],
  [ts.SyntaxKind.TypeAliasDeclaration, 'type'],
  [ts.SyntaxKind.ClassDeclaration, 'class'],
  [ts.SyntaxKind.FunctionDeclaration, 'function'],
  [ts.SyntaxKind.VariableDeclaration, 'const'],
  [ts.SyntaxKind.EnumDeclaration, 'enum'],
  [ts.SyntaxKind.ModuleDeclaration, 'namespace'],
])

/** .vue 组件在 d.ts 里长成 vue-tsc 的 __VLS_ 家族，只记名字（理由见文件头） */
const isCompilerGeneratedComponent = (text) => /\b__VLS_/.test(text) || /DefineComponent</.test(text)

function snapshotPackage(pkgDir, name, entries) {
  const program = ts.createProgram(
    entries.map((e) => e.file),
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      noEmit: true,
    },
  )
  const checker = program.getTypeChecker()
  const symbols = {}
  const conflicts = []

  for (const entry of entries) {
    const sf = program.getSourceFile(entry.file)
    const moduleSymbol = sf?.symbol ?? (sf ? checker.getSymbolAtLocation(sf) : undefined)
    if (!moduleSymbol) {
      console.error(`[api-snapshot] ${name} ${entry.subpath}：拿不到模块符号`)
      process.exit(1)
    }

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const decl = target.declarations?.[0]
      if (!decl) continue

      let kind = DECL_KIND.get(decl.kind) ?? ts.SyntaxKind[decl.kind]
      let text = null
      const raw = normalize(decl.getText())
      if (isCompilerGeneratedComponent(raw)) {
        kind = 'component'
      } else if (raw) {
        text = raw
      }

      const symbolName = exported.getName()
      const record = text ? { kind, text } : { kind }
      const existing = symbols[symbolName]
      if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
        conflicts.push(`${symbolName}：${entry.subpath} 暴露的声明与别处不一致`)
        continue
      }
      symbols[symbolName] = record
    }
  }

  if (conflicts.length) {
    console.error(`[api-snapshot] ${name} 有同名符号但声明不同，快照会失真：`)
    for (const c of conflicts) console.error('  · ' + c)
    process.exit(1)
  }

  const sorted = {}
  for (const key of Object.keys(symbols).sort()) sorted[key] = symbols[key]

  return {
    _note: '由 scripts/gen-api-snapshot.mjs 生成，请勿手改。有意改公开 API 时跑 pnpm gen:api-snapshot，并把 diff 一起提交。',
    package: name,
    entries: entries.map((e) => e.subpath),
    symbols: sorted,
  }
}

/** 符号级差异，比整个 JSON 的 blob diff 好读 */
function describeDiff(before, after) {
  const a = before.symbols ?? {}
  const b = after.symbols ?? {}
  const lines = []
  for (const key of Object.keys(b)) {
    if (!(key in a)) lines.push(`  + 新增 ${key}（${b[key].kind}）`)
    else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) lines.push(`  ~ 签名变了 ${key}（${a[key].kind}）`)
  }
  for (const key of Object.keys(a)) {
    if (!(key in b)) lines.push(`  - 删除 ${key}（${a[key].kind}）`)
  }
  return lines
}

const published = discoverPublicPackages(join(root, 'packages'))
const skipped = published.filter((p) => UI_ADAPTERS.has(p.pkg.name))
const targets = published
  .filter((p) => !UI_ADAPTERS.has(p.pkg.name))
  .sort((a, b) => a.relDir.localeCompare(b.relDir))

function relFile(name) {
  return name.replace('@fbkworks/', '') + '.json'
}

// 新增发布包却没人决定它该不该进快照 —— 这正是「清单漂移」的样子，宁可在这里红。
// 生成模式下不判：那时基线本来就还没写出来。
const unexplained = checkOnly
  ? targets.filter((p) => !existsSync(join(outDir, relFile(p.pkg.name))))
  : []

if (!checkOnly) mkdirSync(outDir, { recursive: true })

let failures = 0
let changed = 0
let totalSymbols = 0

for (const { dir, pkg } of targets) {
  const entries = collectTypeEntries(dir, pkg)
  /* 零入口是失败，不是「跳过」。
     以前这里 continue 并 exit 0：一个包把 exports 改成 string 形态、或换成 ./dist/index.d.mts 后，
     --check 照旧绿、旧基线文件原地冒充保护。判据的覆盖面缩到 0 时必须响。 */
  if (entries.length === 0) {
    console.error(
      `[api-snapshot] ${pkg.name} 没有任何 .d.ts 入口 —— 它的公开类型面完全没被检查。` +
        '\n  检查包 package.json 的 exports 是否还指向 .d.ts 文件。',
    )
    failures += 1
    continue
  }
  const snapshot = snapshotPackage(dir, pkg.name, entries)
  totalSymbols += Object.keys(snapshot.symbols).length

  const file = join(outDir, relFile(pkg.name))
  const next = JSON.stringify(snapshot, null, 2) + '\n'

  if (!checkOnly) {
    writeFileSync(file, next, 'utf8')
    console.log(`[api-snapshot] 写入 ${norm(relative(root, file))}（${Object.keys(snapshot.symbols).length} 个符号）`)
    continue
  }

  if (!existsSync(file)) {
    console.error(`[api-snapshot] 缺少基线 ${norm(relative(root, file))}`)
    failures++
    continue
  }

  const current = readFileSync(file, 'utf8')
  if (current.replace(/\r\n/g, '\n') === next) continue

  changed++
  failures++
  console.error(`[api-snapshot] ${pkg.name} 的公开类型与基线不一致：`)
  for (const line of describeDiff(JSON.parse(current), snapshot)) console.error(line)
}

if (unexplained.length) {
  console.error('[api-snapshot] 有发布包还没决定是否纳入快照：')
  for (const p of unexplained) console.error(`  · ${p.pkg.name}（${p.relDir}）`)
  console.error('  要么给它生成基线，要么加进脚本里的 UI_ADAPTERS 并说明理由。')
  process.exit(1)
}

if (checkOnly) {
  if (failures > 0) {
    console.error(
      `[api-snapshot] ${changed} 个包的公开类型变了。若是有意为之：pnpm gen:api-snapshot，并在提交里带上 diff。`,
    )
    process.exit(1)
  }
  console.log(
    `[api-snapshot] OK：${targets.length} 个包 / ${totalSymbols} 个符号与基线一致（已排除 ${skipped.length} 个 UI 适配器）`,
  )
} else {
  console.log(`[api-snapshot] 完成：${targets.length} 个包 / ${totalSymbols} 个符号，排除 ${skipped.length} 个 UI 适配器`)
}
