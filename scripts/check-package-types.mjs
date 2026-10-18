import { execFile } from 'node:child_process'
import { access, readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'

/**
 * 对每个发布包跑 attw。
 *
 * 两个必要参数：
 * - `--profile esm-only`：本项目首期 ESM-only，CJS 解析失败是预期结果，不应报错。
 * - `--exclude-entrypoints`：exports 里的 `*.css` 不是 TS 模块，attw 无法解析，
 *   必须排除，否则每个带样式的包都会出现假的 Resolution failed。
 */

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')

// 直接跑 CLI 的 JS 入口，而不是依赖 PATH 里的 `attw` shim：
// Windows 上 execFile 不会解析 .cmd，pnpm 的 node_modules/.bin 也不在 PATH 里。
const require = createRequire(import.meta.url)
const attwCli = require.resolve('@arethetypeswrong/cli/package.json').replace(/package\.json$/, 'dist/index.js')

// CSS 入口既可能长成 `./style.css`，也可能长成 `./css`（指向 tokens.css），
// 因此键名和值都要检查。
const isCssEntry = (key, value) =>
  key.endsWith('.css') ||
  (typeof value === 'string' && value.endsWith('.css')) ||
  (value && typeof value === 'object' && Object.values(value).some((v) => typeof v === 'string' && v.endsWith('.css')))

const cssEntrypoints = (exportsField) =>
  Object.entries(exportsField ?? {})
    .filter(([key, value]) => isCssEntry(key, value))
    .map(([key]) => key)

async function discoverPackages() {
  const dirs = []
  for (const group of ['packages', 'packages/adapters', 'packages/internal']) {
    for (const entry of await readdir(join(root, group), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(root, group, entry.name)
      // 跳过 adapters/ 这类只做分组的目录
      try {
        await access(join(dir, 'package.json'))
        dirs.push(dir)
      } catch {
        // 不是包目录
      }
    }
  }
  return dirs
}

const failures = []

for (const dir of await discoverPackages()) {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  // 私有包不发布，attw 没有意义；build-config 直接导出 .ts 源码，也无法被 attw 解析。
  if (pkg.private || !pkg.exports) continue

  const args = ['--pack', dir, '--profile', 'esm-only', '--format', 'table']
  const css = cssEntrypoints(pkg.exports)
  if (css.length) args.push('--exclude-entrypoints', ...css)

  process.stdout.write(`\n[attw] ${pkg.name}\n`)
  try {
    const { stdout } = await execFileAsync(process.execPath, [attwCli, ...args], { cwd: root })
    process.stdout.write(`${stdout}\n`)
  } catch (error) {
    failures.push(pkg.name)
    process.stdout.write(`${error.stdout ?? ''}${error.stderr ?? ''}\n`)
  }
}

if (failures.length) {
  console.error(`\n[attw] 失败：${failures.join(', ')}`)
  process.exit(1)
}

console.log('\n[attw] 全部通过')
