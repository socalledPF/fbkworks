import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * 模板门禁：`templates/*` 里的每个模板必须是「复制出去就能跑」的。
 *
 * ## 为什么需要它
 *
 * `apps/admin` 是 dogfooding demo（private、README 自称 demo、测试要靠 --config 单独跑），
 * 对外来说它不可复制。模板的价值恰恰在「复制 → 装 → 跑」这一条路上，
 * 而这条路**最容易悄悄烂掉**：模板不在 workspace 里，`pnpm install`/`pnpm build` 就碰不到它；
 * 不在根 vitest 的 include 里，`pnpm test` 也碰不到它。
 * 于是「模板还能跑」这件事只剩「有人记得手动跑一遍」—— 那就是烂掉的开始。
 *
 * 所以这道门禁只认可判定的事实，逐条对应上面每一个坑：
 *
 *   1. `templates/` 下至少扫到一个模板（扫到 0 个 = 路径算错了，门禁等于没跑）；
 *   2. 每个模板有 package.json，且 `private: true` —— 模板不是发布包，
 *      漏了这一条它会被 changeset / publint / attw 当成要发的东西；
 *   3. 每个模板有 README.md —— 模板的交付物一半是文档（装/跑/替换哪几处）；
 *   4. 每个模板至少一个测试文件，且落在 `tests/` 下、以 .spec.ts 结尾 ——
 *      这根 vitest.config.ts 的 `templates/**\/tests/**\/*.spec.ts` 是同一个约定，
 *      两边对不上的话 `pnpm test` 会一条都跑不到（那种「绿」最贵）；
 *   5. 每个模板 `pnpm -C templates/<x> build` 真的成功，并且真的产出了 dist/index.html ——
 *      只看退出码不看产物，构建脚本写空也能绿。
 *
 * 已知边界（如实标注）：这条门验的是「能构建 + 有测试」，不是「页面长得对」。
 * 页面级的验收仍然只有人在浏览器里看一眼能替代。
 */

const root = resolve(import.meta.dirname, '..')
const templatesDir = join(root, 'templates')

const rel = (path) => relative(root, path).replace(/\\/g, '/')

const problems = []
const passed = []

/** 测试文件：只认 vitest 根配置 include 覆盖得到的形态 */
const SPEC_FILE = /\.spec\.tsx?$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

let scanned = 0

if (!existsSync(templatesDir) || !statSync(templatesDir).isDirectory()) {
  console.error('[template-smoke] 没有 templates/ 目录 —— 路径算错了，这条门禁等于没跑')
  process.exit(1)
}

const templates = readdirSync(templatesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => ({ name: entry.name, dir: join(templatesDir, entry.name) }))
  .filter((item) => existsSync(join(item.dir, 'package.json')))

if (templates.length === 0) {
  console.error('[template-smoke] templates/ 下一个模板都没扫到 —— 路径算错了，这条门禁等于没跑')
  process.exit(1)
}

for (const template of templates) {
  scanned += 1
  const before = problems.length

  /* ---------- 1. package.json + private: true ---------- */
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(join(template.dir, 'package.json'), 'utf8'))
  } catch (error) {
    problems.push(`${rel(template.dir)}/package.json 解析失败：${error.message}`)
  }
  if (pkg) {
    if (typeof pkg.name !== 'string' || !pkg.name) {
      problems.push(`${rel(template.dir)}/package.json 缺 name`)
    }
    if (pkg.private !== true) {
      problems.push(
        `${rel(template.dir)}/package.json 的 private 不是 true —— 模板不是发布包，` +
          '漏了它 changeset / publint / attw 会把它当成要发的东西',
      )
    }
    if (!pkg.scripts || typeof pkg.scripts.build !== 'string') {
      problems.push(`${rel(template.dir)}/package.json 没有 build 脚本 —— 下面那条构建验证无从谈起`)
    }
  }

  /* ---------- 2. README.md ---------- */
  if (!existsSync(join(template.dir, 'README.md'))) {
    problems.push(`${rel(template.dir)} 缺 README.md —— 模板的一半交付物是「装/跑/替换哪几处」`)
  }

  /* ---------- 3. 至少一个测试文件 ---------- */
  const specs = walk(template.dir).filter(
    (file) => SPEC_FILE.test(file) && rel(file).includes(`/${template.name}/tests/`),
  )
  if (specs.length === 0) {
    problems.push(
      `${rel(template.dir)} 里没有 tests/**/*.spec.ts —— 根 vitest 的 include 是` +
        '「templates/**/tests/**/*.spec.ts」，没有文件就等于 pnpm test 一条都跑不到它',
    )
  }

  /* ---------- 4. pnpm -C templates/<x> build 真的成功，并真的产出 dist/index.html ---------- */
  if (pkg?.scripts?.build) {
    const startedAt = Date.now()
    try {
      execFileSync('pnpm', ['-C', rel(template.dir), 'build'], {
        cwd: root,
        stdio: 'pipe',
        shell: process.platform === 'win32',
        timeout: 10 * 60 * 1000,
        maxBuffer: 32 * 1024 * 1024,
        encoding: 'utf8',
      })
      const entry = join(template.dir, 'dist', 'index.html')
      if (!existsSync(entry) || statSync(entry).size === 0) {
        problems.push(
          `${rel(template.dir)} 构建成功但没有产出 dist/index.html —— ` +
            '构建脚本写空也会退出 0，只看退出码就是假绿',
        )
      }
    } catch (error) {
      const output = String(error.stdout ?? '') + String(error.stderr ?? '') || String(error.message)
      const tail = output.trim().split('\n').slice(-12).join('\n')
      problems.push(
        `${rel(template.dir)} 构建失败（pnpm -C ${rel(template.dir)} build）：\n${tail}`,
      )
      if (/Failed to resolve entry|Cannot find module|Cannot find package/i.test(output)) {
        problems.push(
          '  ↑ 依赖没解析到。若刚检出仓库，先跑 pnpm build 让各包的 dist 就位 —— ' +
            'verify 链里 check:template-smoke 排在 pnpm build 之后',
        )
      }
    }
    if (problems.length === before) {
      passed.push(`${template.name}（build ${((Date.now() - startedAt) / 1000).toFixed(1)}s）`)
    }
  }
}

if (problems.length) {
  console.error(`[template-smoke] 发现 ${problems.length} 处问题：`)
  for (const problem of problems) console.error(`  · ${problem}`)
  process.exit(1)
}

console.log(
  `[template-smoke] OK：${scanned} 个模板（package.json 私有 / README / 冒烟测试 / 构建产物）` +
    ` —— ${passed.join('、')}`,
)
