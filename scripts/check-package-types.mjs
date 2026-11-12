import { execFile } from 'node:child_process'
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
 *
 * 打包用 `pnpm pack` 而不是 attw 的 `--pack`（它内部调 `npm pack`）。
 * 原因：npm 10 的 arborist 在遍历 pnpm 建的 junction 时会在
 * `load-actual.js` 的 `#newLink` 里崩掉（TypeError: Cannot read properties of
 * null (reading 'package')），凡是 `node_modules` 里有 workspace 链接的包
 * 都过不了。pnpm 能正确处理自己的目录结构，所以先由 pnpm 产出 tgz，
 * 再把文件路径交给 attw —— 检查的内容本身完全一样。
 */

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')

// 直接跑 CLI 的 JS 入口，而不是依赖 PATH 里的 shim：
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
  /* 递归发现，与 publish-all / gen-api-snapshot / gen-size-baseline 同一规则：
     目录里有 package.json 就是包，不再往下钻。
     写死三层目录的后果：新增 packages/vue/* 这类分组时，那三道门都看得见它，
     唯独 attw（这道发布形态门禁）静默不查 —— 公开包清单的第 4 份实现且形态不同。 */
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      try {
        await access(join(full, 'package.json'))
        dirs.push(full)
      } catch {
        await walk(full)
      }
    }
  }
  await walk(join(root, 'packages'))
  return dirs
}

/** 用 pnpm 打包，返回生成的 .tgz 绝对路径。 */
async function packWithPnpm(dir) {
  const destination = await mkdtemp(join(tmpdir(), 'fbk-attw-'))
  // pnpm 是跑脚本的那个包管理器（npm run / pnpm verify 下都能解析到）
  const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  await execFileAsync(pnpmBin, ['pack', '--pack-destination', destination], {
    cwd: dir,
    shell: process.platform === 'win32',
  })
  const [tarball] = (await readdir(destination)).filter((name) => name.endsWith('.tgz'))
  if (!tarball) throw new Error(`pnpm pack 未生成 .tgz：${dir}`)
  return { tarball: join(destination, tarball), cleanup: () => rm(destination, { recursive: true, force: true }) }
}

const failures = []
const packErrors = []

for (const dir of await discoverPackages()) {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  // 私有包不发布，attw 没有意义；build-config 直接导出 .ts 源码，也无法被 attw 解析。
  if (pkg.private || !pkg.exports) continue

  let packed
  try {
    packed = await packWithPnpm(dir)
  } catch (error) {
    packErrors.push(`${pkg.name}: ${error.message}`)
    continue
  }

  const args = [packed.tarball, '--profile', 'esm-only', '--format', 'table']
  const css = cssEntrypoints(pkg.exports)
  if (css.length) args.push('--exclude-entrypoints', ...css)

  process.stdout.write(`\n[attw] ${pkg.name}\n`)
  try {
    const { stdout } = await execFileAsync(process.execPath, [attwCli, ...args], { cwd: root })
    process.stdout.write(`${stdout}\n`)
  } catch (error) {
    failures.push(pkg.name)
    process.stdout.write(`${error.stdout ?? ''}${error.stderr ?? ''}\n`)
  } finally {
    await packed.cleanup()
  }
}

if (packErrors.length) {
  console.error(`\n[attw] 打包失败：\n${packErrors.map((line) => `  - ${line}`).join('\n')}`)
  process.exit(1)
}

if (failures.length) {
  console.error(`\n[attw] 失败：${failures.join(', ')}`)
  process.exit(1)
}

console.log('\n[attw] 全部通过')
