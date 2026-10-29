#!/usr/bin/env node
/**
 * 发布产物运行时依赖检查。
 *
 * 为什么需要它（ESLint 和 dependency-cruiser 都不够）：
 *   1. ESLint 的 no-restricted-imports 只看**静态 import 声明**，
 *      `import('dayjs')` 完全绕过（已实测）。虽然补了 no-restricted-syntax，
 *      但规则总有漏法（变量拼接、间接 re-export 等）。
 *   2. dependency-cruiser 同样漏动态 import。
 *   3. 真正要保证的是「**发布出去的产物**里不含被禁依赖」，
 *      检查源码只是手段，检查产物才是目的。
 *
 * 这里直接扫 dist 里所有 .mjs 的 import 语句 —— 不管源码怎么绕，
 * 最终产物里出现的 bare specifier 一定是真实依赖。
 *
 * 检查两类问题：
 *   · 第一类禁止依赖出现在产物里
 *   · 产物的 import 指向了未在 package.json 里声明的包（会运行时报错）
 */

import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** 第一类：禁止的运行时依赖（与 eslint.config.mjs 保持同步） */
const FORBIDDEN = [
  'axios',
  'ky',
  'ofetch',
  'superagent',
  'vue-router',
  'pinia',
  'vuex',
  'vue-i18n',
  'dayjs',
  'moment',
  'lodash',
  'ramda',
  'date-fns',
]

/**
 * 发现发布包：递归扫描 packages/**（覆盖 packages/adapters/*、packages/internal/*），
 * 取 package.json 里 private !== true 的包目录。
 * 名单由文件系统决定而不是手工登记 —— 新增发布包自动纳入，漏登记不可能发生。
 */
async function discoverPublishedPackages(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue

    const full = join(dir, entry.name)
    if (existsSync(join(full, 'package.json'))) {
      const pkgJson = JSON.parse(await readFile(join(full, 'package.json'), 'utf8'))
      if (pkgJson.private !== true) {
        out.push({ dir: full, name: pkgJson.name, relPath: relative(root, full).replace(/\\/g, '/') })
      }
      continue // 包目录不再向下钻，避免把包内子目录误当成包
    }

    await discoverPublishedPackages(full, out)
  }
  // 排序只为输出稳定，不影响扫描范围
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

/**
 * 允许出现在产物 import 里的 bare specifier 前缀。
 * 除这些之外的一律要求已声明在 package.json 的
 * dependencies / peerDependencies / optionalDependencies 里。
 */
const ALLOWED_ALWAYS = ['vue']

const isForbidden = (specifier) =>
  FORBIDDEN.some((name) => specifier === name || specifier.startsWith(`${name}/`))

/** 提取 ESM 的 import 语句（含 re-export 与动态 import） */
function extractSpecifiers(code) {
  const out = new Set()

  // 静态 import / export-from：from 'x'
  for (const m of code.matchAll(/(?:^|\s)(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]/g)) {
    out.add(m[1])
  }
  // 副作用 import：import 'x'
  for (const m of code.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    out.add(m[1])
  }
  // 动态 import：import('x') —— 只处理字面量，变量拼接无法静态分析
  for (const m of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.add(m[1])
  }

  return [...out]
}

/** 判断是否为 bare specifier（非相对、非绝对路径） */
const isBare = (specifier) =>
  !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:')

/** 取包名：@scope/name/sub → @scope/name；name/sub → name */
function packageName(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

async function walkMjs(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walkMjs(full, files)
    else if (entry.name.endsWith('.mjs')) files.push(full)
  }
  return files
}

let failures = 0
const report = (message) => {
  console.error(`[runtime-deps] ${message}`)
  failures += 1
}

let checkedPackages = 0
let checkedFiles = 0
let checkedSpecifiers = 0

const published = await discoverPublishedPackages(join(root, 'packages'))

/** 扫到的包（有 build 产物）与跳过的包分开记录，便于人工核对名单 */
const scanned = []
const skipped = []

for (const pkg of published) {
  const pkgPath = pkg.relPath
  const distDir = join(pkg.dir, 'dist')
  const pkgJsonPath = join(pkg.dir, 'package.json')

  // 无 build 产物 = 无可检查的产物，不纳入本次扫描（不改退出码）
  if (!existsSync(distDir)) {
    skipped.push(pkgPath)
    continue
  }

  const files = await walkMjs(distDir)
  if (files.length === 0) {
    skipped.push(pkgPath)
    continue
  }
  scanned.push(pkgPath)

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
  const declared = new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.peerDependencies ?? {}),
    ...Object.keys(pkgJson.optionalDependencies ?? {}),
  ])

  checkedPackages += 1
  checkedFiles += files.length

  for (const file of files) {
    const code = await readFile(file, 'utf8')
    for (const specifier of extractSpecifiers(code)) {
      if (!isBare(specifier)) continue
      checkedSpecifiers += 1

      const rel = file.replace(root, '').replace(/\\/g, '/')

      // 检查 1：第一类禁止依赖
      if (isForbidden(specifier)) {
        report(`${rel} 引入了禁止的运行时依赖 "${specifier}"`)
        continue
      }

      // 检查 2：内部 @fbkworks 包必须在 dependencies 里声明
      const name = packageName(specifier)
      if (ALLOWED_ALWAYS.includes(name)) continue

      if (!declared.has(name)) {
        report(
          `${rel} 引入了未声明的依赖 "${specifier}"（${pkgPath}/package.json 的 dependencies / peerDependencies 里没有 ${name}）`,
        )
      }
    }
  }
}

if (failures > 0) {
  console.error(
    `\n[runtime-deps] 失败：${failures} 处问题。` +
      `\n  第一类禁止依赖必须由调用方注入（请求用 request prop，日期用 Intl）。` +
      `\n  详见 docs/style-guide.md 的「运行时依赖三类划分」。`,
  )
  process.exit(1)
}

console.log(
  `[runtime-deps] OK：${checkedPackages} 个发布包 / ${checkedFiles} 个产物文件 / ${checkedSpecifiers} 个 bare import，无禁止依赖`,
)
console.log(`[runtime-deps] 扫描的发布包（${scanned.length}）：`)
for (const pkgPath of scanned) console.log(`  · ${pkgPath}`)
if (skipped.length > 0) {
  console.log(`[runtime-deps] 跳过（无 dist 产物，${skipped.length}）：`)
  for (const pkgPath of skipped) console.log(`  · ${pkgPath}`)
}
