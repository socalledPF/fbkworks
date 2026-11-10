import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseDocument } from 'yaml'

/**
 * 语法门禁：workflow 的 YAML 与所有脚本能否被解析。
 *
 * ## 为什么需要它
 *
 * 这不是假想风险。下面是真实发生过的两次事故（同一个根因）：
 *
 *   1. `scripts/check-runtime-deps.mjs` 里字符串中的 `\n` 被模板处理成了真实换行，
 *      把 JS 字符串劈成两行 → 语法错误，整条门禁直接崩。
 *   2. `.github/workflows/ci.yml` 里同样的问题把 YAML 写坏 → GitHub 判定
 *      `Invalid workflow file`，**整个 CI 一次都没跑**（run 名字退化成文件路径、
 *      jobs 为空）。那次 push 的白等成本 = 一整轮 CI 的时间。
 *
 * 这类错误在本地几乎零成本发现，在 CI 上却要等一轮才暴露。所以放在 verify 的第一步。
 */

const root = resolve(import.meta.dirname, '..')
const problems = []

/* ---------- 1. workflow YAML ---------- */
const workflowsDir = join(root, '.github', 'workflows')
let workflows = 0

for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue
  const file = join(workflowsDir, entry.name)
  const text = readFileSync(file, 'utf8')
  const doc = parseDocument(text)
  workflows += 1

  for (const error of doc.errors) {
    problems.push(`.github/workflows/${entry.name}:${error.linePos?.[0]?.line ?? '?'} YAML 解析失败：${error.message}`)
  }
  if (doc.errors.length > 0) continue

  const value = doc.toJS() ?? {}
  if (!value.jobs || Object.keys(value.jobs).length === 0) {
    problems.push(`.github/workflows/${entry.name} 没有任何 job —— GitHub 会直接判它无效`)
  }
  for (const [name, job] of Object.entries(value.jobs ?? {})) {
    if (!job || (!job.steps && !job.uses)) {
      problems.push(`.github/workflows/${entry.name} 的 job「${name}」既没有 steps 也没有 uses`)
    }
  }
}

/* ---------- 2. 脚本能不能被解析 ---------- */
const scriptFiles = []
const collect = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collect(full)
    else if (/\.(mjs|cjs|mts|cts)$/.test(entry.name)) scriptFiles.push(full)
  }
}
collect(join(root, 'scripts'))
/* apps 下的脚本同样会被直接加载并决定整条链路是否跑得起来
   （docs 的 check-mermaid / gen-api / sync-brand）。漏掉它们，
   坏掉要等到 verify 最后一步才暴露。 */
collect(join(root, 'apps'))
/* apps 下的脚本同样会被直接加载并决定整条链路是否跑得起来
   （docs 的 check-mermaid / gen-api / sync-brand）。漏掉它们，
   坏掉要等到 verify 最后一步才暴露。 */
collect(join(root, 'apps'))

/* 根目录的配置文件也算：它们同样会被工具直接加载，坏了同样是整条链路失效 */
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(mjs|cjs|mts|cts)$/.test(entry.name)) scriptFiles.push(join(root, entry.name))
}

for (const file of scriptFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    const detail = String(error.stderr || error.message)
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, 3)
      .join(' / ')
    problems.push(`${relative(root, file).replace(/\\/g, '/')} 语法错误：${detail}`)
  }
}

/* ---------- 结果 ---------- */
if (workflows === 0 || scriptFiles.length === 0) {
  console.error('[syntax] 一个 workflow 都没找到 —— 路径算错了，这道门等于没跑')
  process.exit(1)
}

if (problems.length) {
  console.error(`[syntax] 发现 ${problems.length} 处问题：`)
  for (const problem of problems) console.error(`  · ${problem}`)
  process.exit(1)
}

console.log(
  `[syntax] OK：${workflows} 个 workflow 的 YAML 可解析且都有 job，${scriptFiles.length} 个脚本语法正确`,
)
