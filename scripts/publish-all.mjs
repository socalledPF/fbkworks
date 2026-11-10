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
/** 只校验清单与顺序，不打包也不发布。供 CI 在 changeset publish 之前当闸门用 */
const checkOnly = process.argv.includes('--check-only')

/**
 * 计算拓扑序：被依赖的排前面。
 *
 * 这里**不手写**，理由是它已经被证明会漂移：上一版手写清单漏了 4 个包，
 * 结果发布出 components 依赖一个从未上架的 @fbkworks/data。
 * 后来加的 assertOrder 只能告诉你「漂了」，不能告诉你「应该是什么」——
 * 而这件事本来就有唯一答案：按各包 package.json 里的 @fbkworks 依赖做拓扑排序。
 *
 * 同层用目录名排序，保证结果确定、可复现；遇到环直接报错，
 * 因为那说明仓库里真的存在循环依赖，不该被一个发布脚本悄悄吃掉。
 *
 * 只考虑**已发布包之间**的依赖：指向私有内部包（如 @fbkworks/demos）的边没有排序意义。
 */
function computeOrder(published) {
  const publishedNames = new Set(published.map((pkg) => pkg.name))
  const byName = new Map(published.map((pkg) => [pkg.name, pkg]))
  const depth = new Map()

  /* 依赖深度 = 1 + 已发布依赖的最大深度。按深度分层发布，日志读起来就是
     「先基础层、再适配器、再业务组件」，而不是某个同样合法的偶然顺序。 */
  const depthOf = (pkg, stack = new Set()) => {
    if (depth.has(pkg.name)) return depth.get(pkg.name)
    if (stack.has(pkg.name)) {
      throw new Error(`[publish] 存在循环依赖：${[...stack, pkg.name].join(' → ')}`)
    }
    stack.add(pkg.name)
    const deps = pkg.deps.filter((dep) => publishedNames.has(dep))
    const value = deps.length
      ? 1 + Math.max(...deps.map((dep) => depthOf(byName.get(dep), stack)))
      : 0
    stack.delete(pkg.name)
    depth.set(pkg.name, value)
    return value
  }

  return [...published]
    .sort((a, b) => depthOf(a) - depthOf(b) || a.dir.localeCompare(b.dir))
    .map((pkg) => pkg.dir)
}

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
 * 顺序由 computeOrder() 从文件系统和 package.json 算出来，不再手写。
 * 这里保留两条不变量作为**实现护栏**（算错时会红，而不是悄悄发错顺序）：
 *   · 覆盖：每个 public 包恰好出现一次
 *   · 拓扑：包声明的每个**已发布** @fbkworks 依赖都排在它前面
 *
 * 注意「已发布」这个限定：指向私有内部包（@fbkworks/demos 等）的边没有排序意义，
 * 把它们算进来只会让脚本在无关的包上卡住。
 */
async function resolveOrder() {
  const published = await discoverPublicPackages(join(root, 'packages'))
  const order = computeOrder(published)
  const index = new Map(order.map((dir, i) => [dir, i]))
  const byName = new Map(published.map((p) => [p.name, p]))
  const problems = []

  for (const pkg of published) {
    if (!index.has(pkg.dir)) problems.push(`ORDER 漏了 public 包 ${pkg.name}（${pkg.dir}）`)
  }
  if (order.length !== published.length) {
    problems.push(`顺序里有 ${order.length} 个包，public 包有 ${published.length} 个`)
  }
  for (const pkg of published) {
    const self = index.get(pkg.dir)
    for (const dep of pkg.deps) {
      if (!dep.startsWith('@fbkworks/')) continue
      const target = byName.get(dep)
      /* 公开包依赖私有包必须报错，不能当作"无关边"跳过：
         pnpm publish 会把 workspace:* 改写成具体版本号并发出去，
         而那个私有包从未上架 —— 消费者装不上，且 registry 上的版本无法覆盖。
         这一条闸门是这个形态唯一的守卫。 */
      if (!target) {
        problems.push(`${pkg.name} 依赖了未发布的 ${dep}（公开包不能依赖私有包）`)
        continue
      }
      const depIndex = index.get(target.dir)
      if (depIndex === undefined) problems.push(`${pkg.name} 依赖 ${dep}，但它不在顺序里`)
      else if (self !== undefined && depIndex > self) {
        problems.push(`${pkg.name} 依赖 ${dep}，但它排在前面`)
      }
    }
  }

  if (problems.length) {
    for (const problem of problems) console.error(`[publish] ${problem}`)
    console.error(`\n[publish] ORDER 校验失败（${problems.length} 项），未发布任何包`)
    process.exit(1)
  }

  console.log(`[publish] 顺序校验通过：${published.length} 个 public 包全覆盖，拓扑序成立`)
  // 把算出来的顺序打出来：它是脚本算的，人至少得能看见它是什么
  console.log(`[publish] 顺序：${order.map((dir) => dir.replace('packages/', '')).join(' → ')}`)
  return order
}

const ORDER = await resolveOrder()

if (checkOnly) {
  console.log('[publish] --check-only：清单与拓扑序均通过，未打包也未发布')
  process.exit(0)
}

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
