import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
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
  'packages/adapter-core',
  'packages/adapters/element-plus',
  'packages/adapters/vant',
  'packages/adapters/naive-ui',
  'packages/components',
  'packages/resolver',
]

const results = []

for (const dir of ORDER) {
  const cwd = join(root, dir)
  const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))

  if (pkg.private) {
    console.log(`[publish] 跳过私有包 ${pkg.name}`)
    continue
  }

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
