#!/usr/bin/env node
/**
 * 变更影响分析。设计见 docs/design/2026-10-25-change-impact-analysis.md。
 *
 * 改了 ProTable，怎么知道哪些地方会受影响？现状是靠人记。
 * 这个脚本用 dependency-cruiser 的依赖图算反向传递闭包，
 * 输出受影响的文件 / 包 / 应用。
 *
 * **退出码永远是 0**（脚本自身出错除外）。
 * 影响范围大不等于有问题 —— 如果影响大就阻断 CI，
 * 团队会开始「为了过 CI 而拆小 PR」，反而让变更更难审查。
 *
 * 用法：
 *   node scripts/check-impact.mjs                    # 对比 HEAD~1
 *   node scripts/check-impact.mjs --base origin/main # 对比指定分支
 *   node scripts/check-impact.mjs --files a.ts b.ts  # 手动指定
 *   node scripts/check-impact.mjs --format markdown  # PR 评论用
 */

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeImpact, isGlobalConfig, suggestChecks, summarize } from './lib/analyze.mjs'
import {
  affectedPackages,
  getChangedFiles,
  loadGraph,
  loadPackageGraph,
  normalize,
  packageOfFile,
} from './lib/build-graph.mjs'
import { formatConsole, formatJson, formatMarkdown } from './lib/report.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 解析命令行参数。手写而不是引依赖 —— 只有四个开关 */
function parseArgs(argv) {
  const opts = { base: 'HEAD~1', head: 'HEAD', files: null, format: 'console' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base') opts.base = argv[++i]
    else if (arg === '--head') opts.head = argv[++i]
    else if (arg === '--format') opts.format = argv[++i]
    else if (arg === '--files') {
      opts.files = []
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.files.push(argv[++i])
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true
    }
  }
  return opts
}

const HELP = `
变更影响分析

用法：
  node scripts/check-impact.mjs [选项]

选项：
  --base <ref>        对比的基准（默认 HEAD~1）
  --head <ref>        对比的目标（默认 HEAD）
  --files <a> <b>     手动指定变更文件，跳过 git diff
  --format <fmt>      console | markdown | json（默认 console）
  -h, --help          显示帮助

说明：
  退出码永远是 0。影响范围大不等于有问题，判断权在人。
`

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(HELP)
    return
  }

  // 1. 取变更文件
  const changedFiles = (opts.files ?? (await getChangedFiles(root, opts)))
    .map(normalize)
    .filter(Boolean)

  if (changedFiles.length === 0) {
    if (opts.format === 'json') {
      console.log(JSON.stringify({ changedFiles: [], impacts: {}, apps: [], packages: [], suggestedChecks: [] }, null, 2))
    } else if (opts.format === 'markdown') {
      console.log('## 变更影响分析\n\n没有检测到文件变更。')
    } else {
      console.log('\n没有检测到文件变更。\n')
    }
    return
  }

  // 2. 取依赖图（文件级 + 包级）
  const graph = await loadGraph(root)
  const pkgGraph = await loadPackageGraph(root, [
    'packages',
    'packages/adapters',
    'packages/internal',
    'apps',
  ])

  // 3. 分析
  const globals = changedFiles.filter(isGlobalConfig)
  const impacts = analyzeImpact(graph, changedFiles, {
    reverse: pkgGraph.reverse,
    dirs: pkgGraph.dirs,
    packageOfFile: (f) => packageOfFile(f, pkgGraph.dirs),
    affectedPackages: (seed) => affectedPackages(pkgGraph, seed),
  })
  const summary = summarize(impacts)
  const checks = suggestChecks(summary, globals)

  const payload = { changedFiles, globals, summary, checks }

  // 4. 输出
  if (opts.format === 'json') {
    console.log(formatJson(payload))
  } else if (opts.format === 'markdown') {
    console.log(formatMarkdown(payload))
  } else {
    console.log(formatConsole(payload))
  }

  /* 供调试：把「受影响文件所属的包」也打出来。
     只在 console 模式且文件多时给一行摘要，避免噪音。 */
  if (opts.format === 'console' && summary.packages.length > 0) {
    console.log(`受影响包：${summary.packages.join(', ')}`)
    console.log('')
  }
}

main().catch((err) => {
  /* 脚本自身出错才非 0 —— 这类错误需要被看到 */
  console.error(`[impact] ${err.message}`)
  process.exit(1)
})
