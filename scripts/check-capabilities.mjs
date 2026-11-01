import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * strict 模式跑能力位覆盖检查：`unverified` 也算失败。
 *
 * 平时的 `pnpm test` 已经跑同一份用例（普通模式）—— 它能拦住**新增**的
 * 未交代能力位，但已登记的欠债会被放过。这个脚本是还债用的：
 * 发版前跑一次，逼着把 unverified 清零（要么补验证，要么降级为 false）。
 */
const run = promisify(execFile)

try {
  const { stdout } = await run(
    'npx',
    ['vitest', 'run', 'packages/internal/adapter-conformance/tests/capability-coverage.spec.ts'],
    { env: { ...process.env, FBK_STRICT_CAPABILITIES: '1' }, shell: process.platform === 'win32' },
  )
  console.log(stdout.split('\n').filter((l) => /Tests\s/.test(l)).join('\n') || stdout)
  console.log('[check-capabilities] strict 通过：没有未验证的能力位')
} catch (error) {
  const output = String(error.stdout ?? error.message)
  const tail = output.split('\n').filter((l) => /×|未验证|unverified|Tests\s/.test(l))
  console.error(tail.join('\n') || output)
  console.error('\n[check-capabilities] strict 失败：仍有能力位没有验证责任')
  process.exit(1)
}
