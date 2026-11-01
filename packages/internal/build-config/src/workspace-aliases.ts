import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * 从各包的 `package.json` → `exports` 推导 Vite alias。
 *
 * 为什么要有这个函数：同一个事实（哪个包在哪、叫什么名字）此前在三个应用里
 * 各手工维护一份，而三份清单漂移的方向互不相同 —— playground 缺图表三包、
 * docs 缺四个包又缺适配器的 `style.css` 子路径、admin 缺它确实 import 了的
 * `data`。每多一份副本就多一个「只有那一个应用会坏」的故障面。
 *
 * 推导规则只有一条：**`dist/` 换成 `src/`，`.mjs`/`.js` 换成 `.ts`，`.css` 保持。**
 * 于是 `tokens/css`、`tokens/cyber.css`、`demos/style.css`、`components/<子路径>`
 * 这些看起来特殊的形态全部自动覆盖，不需要为任何包写特例。
 *
 * 所有 find 都是 **锚定的精确匹配**（`^...$`），不是前缀 —— 因此不存在
 * 「CSS 子路径必须排在通配规则前面」这类顺序陷阱：条目之间互不干扰。
 */

export interface WorkspaceAlias {
  find: RegExp
  replacement: string
}

export interface CreateWorkspaceAliasesOptions {
  /** 从哪里开始向上找仓库根。通常传调用方的 `import.meta.dirname` */
  from: string
  /** 跳过的包名，例如 `['@fbkworks/docs']` */
  skip?: string[]
  /**
   * 手动覆盖：包名 → 子路径（`''` 表示裸包名）→ 源码路径（相对仓库根）。
   * 只在某个包的产物布局不遵循 `dist ↔ src` 同构时才用。
   */
  overrides?: Record<string, Record<string, string>>
}

/** 向上找带 pnpm-workspace.yaml 的目录 */
export function findRepoRoot(from: string): string {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`[workspace-aliases] 从 ${from} 向上没找到 pnpm-workspace.yaml`)
    }
    dir = parent
  }
}

interface PkgInfo {
  name: string
  dir: string
  exports: Record<string, unknown> | undefined
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'src', '.turbo'])

function collectPackages(dir: string, out: PkgInfo[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    const pkgJson = join(full, 'package.json')
    if (existsSync(pkgJson)) {
      const pkg = JSON.parse(readFileSync(pkgJson, 'utf8')) as Record<string, unknown>
      if (typeof pkg.name === 'string' && pkg.exports) {
        out.push({ name: pkg.name, dir: full, exports: pkg.exports as Record<string, unknown> })
      }
      // 包目录不再向下钻，避免把包内子目录当成包
      continue
    }
    collectPackages(full, out)
  }
}

/** 条件导出的取值：优先 import，其次 default，最后退回第一个字符串值 */
function pickTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return pickTarget(value[0])
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['import', 'default', 'module', 'browser']) {
      const picked = pickTarget(record[key])
      if (picked) return picked
    }
  }
  return undefined
}

/** `./dist/a/b.mjs` → `./src/a/b.ts`；已经指向源码的原样返回 */
function toSourcePath(target: string): string | undefined {
  if (target.startsWith('./src/')) return target
  if (!target.startsWith('./dist/')) return undefined
  const rest = target.slice('./dist/'.length)
  if (rest.endsWith('.d.ts')) return undefined
  const swapped = rest.replace(/\.m?js$/, '.ts')
  return `./src/${swapped}`
}

export function createWorkspaceAliases(options: CreateWorkspaceAliasesOptions): WorkspaceAlias[] {
  const root = findRepoRoot(options.from)
  const skip = new Set(options.skip ?? [])
  const packages: PkgInfo[] = []
  collectPackages(join(root, 'packages'), packages)

  const aliases: WorkspaceAlias[] = []

  const push = (specifier: string, replacement: string): void => {
    aliases.push({ find: new RegExp(`^${escapeRegExp(specifier)}$`), replacement })
  }

  for (const pkg of packages) {
    if (skip.has(pkg.name)) continue

    for (const [key, rawValue] of Object.entries(pkg.exports ?? {})) {
      if (key === './package.json') continue
      const specifier = key === '.' ? pkg.name : `${pkg.name}${key.slice(1)}`

      const override = options.overrides?.[pkg.name]?.[key === '.' ? '' : key.slice(2)]
      if (override) {
        push(specifier, resolve(root, override))
        continue
      }

      const target = pickTarget(rawValue)
      if (!target) continue
      const sourcePath = toSourcePath(target)
      if (!sourcePath) continue

      const absolute = join(pkg.dir, sourcePath)
      /* 只产出源码真实存在的条目。产物里有、源码里没有的（例如 components 的
         dist/style.css 聚合产物），继续留给 exports 去解析构建结果。 */
      if (!existsSync(absolute)) continue
      push(specifier, absolute)
    }
  }

  return aliases
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 诊断用：按包列出「已别名 / 跳过（源码缺失）/ 未处理」的明细 */
export function describeWorkspaceAliases(options: CreateWorkspaceAliasesOptions): string[] {
  const root = findRepoRoot(options.from)
  const packages: PkgInfo[] = []
  collectPackages(join(root, 'packages'), packages)
  const lines: string[] = []
  for (const pkg of packages) {
    for (const [key, rawValue] of Object.entries(pkg.exports ?? {})) {
      if (key === './package.json') continue
      const target = pickTarget(rawValue)
      const sourcePath = target ? toSourcePath(target) : undefined
      if (!sourcePath) {
        lines.push(`  skip      ${pkg.name}${key === '.' ? '' : key.slice(1)}  （不是源码入口）`)
        continue
      }
      const absolute = join(pkg.dir, sourcePath)
      const specifier = key === '.' ? pkg.name : `${pkg.name}${key.slice(1)}`
      lines.push(
        existsSync(absolute)
          ? `  alias     ${specifier}  →  ${relative(root, absolute)}`
          : `  skip      ${specifier}  （源码不存在：${sourcePath}）`,
      )
    }
  }
  return lines
}
