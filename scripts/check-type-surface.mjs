import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve('packages/components/dist')

if (!existsSync(root)) {
  console.error('[type-surface] packages/components/dist 不存在，请先执行 pnpm build')
  process.exit(1)
}

const banned = [
  { re: /from ['"]element-plus(\/[^'"]*)?['"]/, label: 'element-plus' },
  { re: /from ['"]vant(\/[^'"]*)?['"]/, label: 'vant' },
  { re: /from ['"]naive-ui(\/[^'"]*)?['"]/, label: 'naive-ui' },
  {
    re: /from ['"]@fbk\/adapter-(?!core)[^'"]*['"]/,
    label: '具体适配器实现（components 只能依赖 @fbk/adapter-core）',
  },
]

let failures = 0

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(path)
      continue
    }
    if (!path.endsWith('.d.ts')) continue
    const text = await readFile(path, 'utf8')
    for (const { re, label } of banned) {
      if (re.test(text)) {
        console.error(`[type-surface] ${path} 泄漏了 ${label}`)
        failures++
      }
    }
  }
}

await walk(root)

if (failures > 0) {
  console.error(`[type-surface] 发现 ${failures} 处类型泄漏`)
  process.exit(1)
}
console.log('[type-surface] OK：公开 d.ts 未泄漏 UI 库类型')
