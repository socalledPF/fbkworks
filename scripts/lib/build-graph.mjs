/**
 * 构建依赖图。
 *
 * 数据源是 dependency-cruiser 的 JSON 输出 —— 复用它而不是自己解析 import，
 * 因为我们已经在 CI 里跑它做依赖方向门禁，图是现成的、且经过别名解析。
 *
 * 关键点：depcruise 输出的 `dependents` 只有**直接**依赖者，
 * 传递闭包要自己算（见 analyze.mjs）。
 */

import { execFile } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'

const execFileAsync = promisify(execFile)

/**
 * 依赖图。
 *
 * `reverse` 是「谁依赖我」的邻接表 —— 变更影响分析只需要反向遍历。
 */
export function createGraph(modules) {
  /** @type {Map<string, Set<string>>} 被依赖方 → 依赖它的文件集合 */
  const reverse = new Map()
  /** @type {Set<string>} 图里所有模块 */
  const nodes = new Set()

  for (const mod of modules) {
    const source = normalize(mod.source)
    if (!source) continue
    nodes.add(source)

    for (const dep of mod.dependencies ?? []) {
      // resolved 为 undefined 说明没解析到文件（外部依赖或动态 import）
      const target = normalize(dep.resolved)
      if (!target) continue

      if (!reverse.has(target)) reverse.set(target, new Set())
      reverse.get(target).add(source)
    }
  }

  return { reverse, nodes }
}

/** 统一成正斜杠 + 去掉开头的 ./ */
export function normalize(p) {
  if (!p || typeof p !== 'string') return null
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * 调 dependency-cruiser 拿图。
 *
 * 为什么不把 depcruise 的 JSON 缓存到磁盘：
 * 图会随代码变化，缓存就要处理失效 —— 这里跑一次约 1 秒，不值得。
 */
export async function loadGraph(root, { targets = ['packages', 'apps'], config } = {}) {
  const args = [...targets, '--config', config ?? 'dependency-cruiser.config.mjs', '--output-type', 'json']

  let stdout
  try {
    const result = await execFileAsync('npx', ['depcruise', ...args], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    })
    stdout = result.stdout
  } catch (err) {
    // depcruise 在有违规时退出码非 0，但 JSON 仍然输出到 stdout
    if (err.stdout) {
      stdout = err.stdout
    } else {
      throw new Error(`[impact] dependency-cruiser 执行失败：${err.message}`)
    }
  }

  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('[impact] dependency-cruiser 输出不是合法 JSON')
  }

  return createGraph(parsed.modules ?? [])
}

/** 从 git 取变更文件（相对仓库根） */
export async function getChangedFiles(root, { base = 'HEAD~1', head = 'HEAD' } = {}) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', base, head],
      { cwd: root, maxBuffer: 8 * 1024 * 1024 },
    )
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (err) {
    throw new Error(
      `[impact] 无法读取 git diff（${base}..${head}）：${err.message}\n` +
        '  提示：如果仓库只有一个提交，用 --files 手动指定，或确认 base 分支存在。',
    )
  }
}

/**
 * 读所有 workspace 包的 package.json，建**包级**反向依赖图。
 *
 * 为什么需要它：dependency-cruiser 的 `doNotFollow` 排除了 `@fbkworks/*`，
 * 所以跨包依赖（components → data）不出现在文件级图里。
 * 结果就是「改了 @fbkworks/data 的契约，却分析不出 components 受影响」——
 * 而这恰恰是最需要提醒的跨包破坏性变更。
 *
 * 这一层补上包级别的传播：data 变了 → 所有依赖 data 的包都受影响。
 */
export async function loadPackageGraph(root, scanDirs) {
  /** @type {Map<string, string[]>} 包名 → 直接依赖它的包名 */
  const reverse = new Map()
  /** @type {Map<string, string>} 包名 → 包目录（用于把文件映射回包） */
  const dirs = new Map()

  /* scanDirs 是「可能包含包的父目录」。
     例如 'packages' 下面有 data/ components/ …，需要遍历一层子目录。
     直接传 'packages/data' 这种具体包目录也能处理（它会自己找到
     package.json），所以两种写法都兼容。 */
  const candidates = []
  for (const dir of scanDirs) {
    const abs = join(root, dir)
    // 该目录自己就是包
    if (await hasFile(join(abs, 'package.json'))) {
      candidates.push(dir)
      continue
    }
    // 否则遍历它的子目录
    try {
      for (const entry of await readdir(abs, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const sub = `${dir}/${entry.name}`
        if (await hasFile(join(root, sub, 'package.json'))) candidates.push(sub)
      }
    } catch {
      /* 目录不存在就跳过 */
    }
  }

  for (const dir of candidates) {
    try {
      const raw = await readFile(join(root, dir, 'package.json'), 'utf8')
      const pkg = JSON.parse(raw)
      if (!pkg.name) continue

      dirs.set(pkg.name, dir)

      const deps = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ]
      for (const dep of deps) {
        if (!dep.startsWith('@fbkworks/')) continue
        if (!reverse.has(dep)) reverse.set(dep, [])
        reverse.get(dep).push(pkg.name)
      }
    } catch {
      /* package.json 解析失败就跳过 */
    }
  }

  return { reverse, dirs }
}

/** 文件是否存在 */
async function hasFile(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** 把文件路径映射回所属包名。依赖 dirs 表，避免猜路径规则 */
export function packageOfFile(file, dirs) {
  const f = normalize(file)
  if (!f) return null
  let best = null
  let bestLen = -1

  for (const [name, dir] of dirs) {
    const d = normalize(dir)
    if (f.startsWith(`${d}/`) && d.length > bestLen) {
      best = name
      bestLen = d.length
    }
  }
  return best
}

/** 包级传递闭包：某个包受影响时，哪些包跟着受影响 */
export function affectedPackages(pkgGraph, seedPackages) {
  const out = new Set(seedPackages)
  const queue = [...seedPackages]

  while (queue.length > 0) {
    const pkg = queue.shift()
    for (const dependent of pkgGraph.reverse.get(pkg) ?? []) {
      if (!out.has(dependent)) {
        out.add(dependent)
        queue.push(dependent)
      }
    }
  }
  return out
}

export const ROOT_MARKER = resolve
