import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

/**
 * 按依赖顺序发布全部公开包。
 *
 * 两个必须踩到的点：
 *
 * 1. **必须走 `pnpm publish`，不能用 `npm publish`。**
 *    包之间用的是 `workspace:^` 协议，只有 pnpm 会在打包时把它改写成真实版本号
 *    （`^0.1.0`）。用 npm 发布出去的 tarball 里会字面量保留 `workspace:^`，
 *    消费者安装直接失败，而且 registry 上的版本无法覆盖，只能发新版本。
 *
 * 2. **顺序不能乱。** npm 不校验依赖是否已存在，先发 components 再发 adapter-core
 *    也能成功，但那一刻的 `0.1.0` 是坏的。按拓扑序发，保证任何时刻已发布集合都是可装的。
 */

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const dryRun = process.argv.includes('--dry-run')

/** 拓扑序：被依赖的排前面 */
const ORDER = [
  'packages/tokens',
  'packages/shared',
  'packages/data',
  'packages/adapter-core',
  'packages/chart-core',
  'packages/adapters/element-plus',
  'packages/adapters/vant',
  'packages/adapters/naive-ui',
  'packages/components',
  'packages/dashboard',
  'packages/screen',
  'packages/resolver',
]

/** 递归找 public 包；包目录不再向下钻，避免把包内子目录误当成包 */
async function discoverPublicPackages(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue

    const full = join(dir, entry.name)
    if (existsSync(join(full, 'package.json'))) {
      const pkg = JSON.parse(await readFile(join(full, 'package.json'), 'utf8'))
      if (pkg.private !== true) {
        out.push({
          dir: relative(root, full).replace(/\\/g, '/'),
          name: pkg.name,
          // 三种声明都会让消费者侧去解析包名，顺序都得成立
          deps: Object.keys({
            ...pkg.dependencies,
            ...pkg.peerDependencies,
            ...pkg.optionalDependencies,
          }),
        })
      }
      continue
    }

    await discoverPublicPackages(full, out)
  }
  return out
}

/**
 * ORDER 是手写清单，一定会漂移（这一版就漏了 4 个包，发布出去 components 会依赖
 * 一个从未上架的 @fbk/data）。所以每次发布前用文件系统核对，绝不靠人记。
 *
 * 两个不变量：
 *   · 覆盖：public 包集合 == ORDER 集合
 *   · 拓扑：包声明的每个 @fbk 依赖都排在它前面
 */
async function assertOrder() {
  const published = await discoverPublicPackages(join(root, 'packages'))
  const index = new Map(ORDER.map((dir, i) => [dir, i]))
  const byName = new Map(published.map((p) => [p.name, p]))
  const problems = []

  for (const pkg of published) {
    if (!index.has(pkg.dir)) problems.push(`ORDER 漏了 public 包 ${pkg.name}（${pkg.dir}）`)
  }
  for (const dir of ORDER) {
    if (!published.some((p) => p.dir === dir)) {
      problems.push(`ORDER 里的 ${dir} 不是 public 包（已私有或已删除）`)
    }
  }
  for (const pkg of published) {
    const self = index.get(pkg.dir)
    for (const dep of pkg.deps) {
      if (!dep.startsWith('@fbk/')) continue
      const target = byName.get(dep)
      const depIndex = target ? index.get(target.dir) : undefined
      if (depIndex === undefined) problems.push(`${pkg.name} 依赖 ${dep}，但它在 ORDER 里不存在`)
      else if (self !== undefined && depIndex > self) {
        problems.push(`${pkg.name} 依赖 ${dep}，但 ORDER 里 ${dep} 排在它后面`)
      }
    }
  }

  if (problems.length) {
    for (const problem of problems) console.error(`[publish] ${problem}`)
    console.error(`\n[publish] ORDER 校验失败（${problems.length} 项），未发布任何包`)
    process.exit(1)
  }

  console.log(`[publish] ORDER 校验通过：${published.length} 个 public 包全覆盖，拓扑序成立`)
}

await assertOrder()

const results = []

for (const dir of ORDER) {
  const cwd = join(root, dir)
  const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))

  const args = ['publish', '--access', 'public', '--no-git-checks']
  if (dryRun) args.push('--dry-run')

  console.log(`\n[publish] ${pkg.name}@${pkg.version}${dryRun ? '（dry-run）' : ''}`)
  try {
    // pnpm 的输出很长，只在成功后回收最后几行做摘要
    const { stdout } = await run('pnpm', args, { cwd, shell: process.platform === 'win32' })
    const summary = stdout.trim().split('\n').filter(Boolean).slice(-3).join('\n')
    console.log(summary)
    results.push({ name: pkg.name, version: pkg.version, ok: true })
  } catch (error) {
    console.error(`[publish] 失败：${pkg.name}`)
    console.error(error.stdout || error.message)
    results.push({ name: pkg.name, version: pkg.version, ok: false })
    // 依赖已经发出去了，但后面一个都不该再发：先修问题再重来
    break
  }
}

console.log('\n[publish] 汇总')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}@${r.version}`)
}

const failed = results.filter((r) => !r.ok).length
if (failed) {
  console.error(`\n[publish] ${failed} 个包失败，已停止后续发布`)
  process.exit(1)
}
if (dryRun) console.log('\n[publish] dry-run 全部通过，去掉 --dry-run 即可正式发布')
