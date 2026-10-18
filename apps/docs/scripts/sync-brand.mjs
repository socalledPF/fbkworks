import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * 把仓库的品牌资产同步到文档站的 public/。
 *
 * 为什么要有这一步：VitePress 的 public/ 只能按 URL 引用，不能走打包器，
 * 所以品牌文件必须存在那里。直接手工复制一份会产生第二个副本，
 * 改了 assets/brand 忘了改 public 就会静默走样——用脚本同步从机制上消除。
 *
 * 源：assets/brand/  →  目标：apps/docs/public/
 */

const docsRoot = resolve(import.meta.dirname, '..')
const sourceDir = resolve(docsRoot, '../../assets/brand')
const targetDir = join(docsRoot, 'public')

/** 只同步文档站真正用到的文件，不是无脑全拷 */
const NEEDED = ['fbk-mark.svg', 'fbk-mark-dark.svg', 'fbk-app-icon.svg']

/**
 * SVG 必须在同步时就校验 XML 合法性。
 *
 * 这不是防御性编程，是真踩过：注释里写了 CSS 变量名 `--fbk-color-primary`，
 * 而 XML 注释**不允许出现连续两个连字符**。浏览器拿到这个文件不会报错——
 * 它只是解码失败，`naturalWidth` 停在 0，然后显示破图占位符并把 alt 文本
 * 渲染出来（于是导航条上出现「FBK FBK」）。整条链路静默失败，
 * 光看 HTTP 200 什么都发现不了。
 */
function assertWellFormedXml(name, text) {
  const problems = []
  if (!text.trimStart().startsWith('<')) problems.push('不是以 < 开头')
  // 注释体内的连续连字符 → 解析器直接判定 not well-formed
  for (const [, body] of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (body.includes('--')) problems.push('注释里含连续连字符 "--"（XML 注释不允许）')
  }
  // 标签配对粗查：开合标签数量应一致（排除自闭合与注释）
  const stripped = text.replace(/<!--[\s\S]*?-->/g, '')
  for (const tag of ['svg', 'g', 'title']) {
    const open = (stripped.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
    const close = (stripped.match(new RegExp(`</${tag}>`, 'g')) || []).length
    if (open !== close) problems.push(`<${tag}> 开合不配对（${open} 开 / ${close} 闭）`)
  }
  if (problems.length) {
    console.error(`[sync-brand] 品牌资产 XML 非法：assets/brand/${name}`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
}

await mkdir(targetDir, { recursive: true })

const available = new Set(await readdir(sourceDir))
for (const name of NEEDED) {
  if (!available.has(name)) {
    console.error(`[sync-brand] 缺少品牌资产：assets/brand/${name}`)
    process.exit(1)
  }
  const source = join(sourceDir, name)
  assertWellFormedXml(name, await readFile(source, 'utf8'))
  await copyFile(source, join(targetDir, name))
}

// favicon 走标准命名，浏览器和爬虫默认就会请求这个路径
await copyFile(join(sourceDir, 'fbk-app-icon.svg'), join(targetDir, 'favicon.svg'))

console.log(`[sync-brand] ${NEEDED.length + 1} 个品牌文件已同步到 apps/docs/public/`)
