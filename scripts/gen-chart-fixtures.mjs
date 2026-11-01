import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/** 重新冻结图表 option 基线。与 check-capabilities 同构：跨平台地设环境变量跑 vitest。 */
const run = promisify(execFile)

const files = [
  'packages/dashboard/tests/chart-option.spec.ts',
  'packages/screen/tests/chart-option.spec.ts',
]

try {
  const { stdout } = await run('npx', ['vitest', 'run', ...files], {
    env: { ...process.env, FBK_UPDATE_CHART_FIXTURES: '1' },
    shell: process.platform === 'win32',
  })
  console.log(stdout.split('\n').filter((l) => /Tests\s/.test(l)).join('\n'))
  console.log('[gen-chart-fixtures] 基线已重新生成 —— 提交前请核对 diff，只应有预期的变化')
} catch (error) {
  console.error(String(error.stdout ?? error.message))
  process.exit(1)
}
