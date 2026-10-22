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
import { join, resolve } from 'node:path'

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

/** 发布包（与 pnpm-workspace.yaml 的 packages/* 对应，排除内部包） */
const PUBLISHED = [
  'packages/tokens',
  'packages/shared',
  'packages/adapter-core',
  'packages/components',
  'packages/chart-core',
  'packages/dashboard',
  'packages/screen',
]

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

for (const pkgPath of PUBLISHED) {
  const pkgDir = resolve(root, pkgPath)
  const distDir = join(pkgDir, 'dist')
  const pkgJsonPath = join(pkgDir, 'package.json')

  if (!existsSync(distDir)) {
    console.error(`[runtime-deps] ${pkgPath}/dist 不存在，请先执行 pnpm build`)
    failures += 1
    continue
  }

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
  const declared = new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.peerDependencies ?? {}),
    ...Object.keys(pkgJson.optionalDependencies ?? {}),
  ])

  const files = await walkMjs(distDir)
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

      // 检查 2：内部 @fbk 包必须在 dependencies 里声明
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
