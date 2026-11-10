import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * 在**全新克隆**里跑一遍 CI 序列。
 *
 * 为什么要这个脚本：本项目已经三次「本地全绿、CI 挂」——
 *   1. `dist` 被 gitignore，CI 没有产物，vitest / tsconfig 缺 alias
 *   2. `apps/docs/.vitepress/theme/generated/api.json` 被 gitignore，
 *      而 `docs:build` 没跑生成器
 *   3. windows-latest 的 `core.autocrlf=true` 检出成 CRLF，
 *      与生成器产出的 LF 对不上，`check:style-index` 假红
 *
 * 三次的共同点都是同一句话：**本地工作树 ≠ 全新克隆**。
 * 本地有残留产物、有别人写过的行尾、有没提交的构建缓存；CI 从零开始。
 *
 * 所以这个脚本就做一件事：克隆到临时目录，按 CI 的方式装依赖并跑门禁。
 * 它校验的是**已提交的状态**（HEAD），不含未提交改动。
 *
 * 用法：
 *   pnpm verify:fresh            # 全量
 *   pnpm verify:fresh --keep     # 保留临时目录，便于进去排查
 *   pnpm verify:fresh --remote   # 从 origin 克隆（默认克隆本地仓库的 HEAD，更快）
 *
 * 实测耗时（Windows，pnpm store 已热，两次）：
 *   clone 2.4s + install --frozen-lockfile 24s + pnpm verify 144–216s
 *   合计 **171–243s**（差异来自 turbo / tsc 缓存的冷热）
 *
 * 曾有过一个 --quick 模式（只跑生成产物相关检查 + docs:build），
 * **已删除**：实测 211s，只比全量快 30 秒，却少覆盖一大类失败。
 * 一个「稍快但少查」的开关只会制造虚假信心 —— 那正是本项目一直在防的东西。
 * 真正的早期信号已经在 `pnpm verify` 里：生成结果检查排在第 8 / 14 / 15 步，
 * 坏了会立刻停，不必等完 4 分钟。
 *
 * 为什么不放进 CI：CI 本身就是全新克隆，重复跑没有信息增量。
 * 这是**推送前的手动关卡**，用来替代「靠人记得手动克隆一遍」。
 */

const flags = new Set(process.argv.slice(2))
const keep = flags.has('--keep')
const fromRemote = flags.has('--remote')

const repoRoot = resolve(import.meta.dirname, '..')
const started = Date.now()

const step = (name) => {
  const at = Date.now()
  console.log(`\n\u001b[36m▶ ${name}\u001b[0m`)
  return () => console.log(`\u001b[32m✔ ${name}\u001b[0m  ${((Date.now() - at) / 1000).toFixed(1)}s`)
}

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 失败（退出码 ${result.status}）`)
  }
}

/* 未提交改动不会进克隆，先说清楚，免得白跑一趟 */
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  if (dirty) {
    console.log('\u001b[33m注意：工作区有未提交改动，它们不在本次校验范围内（克隆的是 HEAD）\u001b[0m')
  }
} catch {
  /* 不是 git 仓库就不管 */
}

const source = fromRemote
  ? execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  : repoRoot

const dest = join(tmpdir(), `fbk-fresh-${Date.now()}`)
console.log(`克隆源：${source}`)
console.log(`目标：  ${dest}`)

let failed = false

try {
  let done = step('git clone（强制 core.autocrlf=true，模拟 Windows CI 的最坏情况）')
  /* 强制 autocrlf=true：.gitattributes 的 eol=lf 必须压得住它。
     哪天 .gitattributes 被误删，这一步会立刻把问题暴露出来。 */
  run('git', ['-c', 'core.autocrlf=true', 'clone', '--depth', '1', '-q', source, dest])
  done()

  done = step('pnpm install --frozen-lockfile（同时校验锁文件是否同步）')
  run('pnpm', ['install', '--frozen-lockfile'], dest)
  done()

  /* 别写死步数：它会漂。这里只声明跑的是 verify 链，
     并明确它**不含**浏览器采证 —— 那 6 个脚本要起 dev server，属于 CI 的 visual job。 */
  done = step('pnpm verify（本地全部门禁；不含 CI 的 6 个浏览器脚本）')
  run('pnpm', ['verify'], dest)
  done()

  console.log(`\n\u001b[32m全部通过\u001b[0m  用时 ${((Date.now() - started) / 1000).toFixed(1)}s`)
} catch (error) {
  failed = true
  console.error(`\n\u001b[31m失败：${error.message}\u001b[0m`)
} finally {
  if (keep || failed) {
    console.log(`临时目录已保留：${dest}`)
  } else if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true })
  }
}

if (failed) process.exitCode = 1
