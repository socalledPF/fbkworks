import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 把入口 CSS 里的 @import 递归内联成单文件。
 *
 * 为什么需要它：Vite library mode 只对 JS 入口里 import 的 CSS 做抽取，
 * 而本项目的约定是"样式不进入 JS barrel"（否则 tree-shaking 失效、SSR 报错）。
 * 因此 dist/style.css 这个聚合入口必须由构建脚本单独拼出来。
 *
 * 只支持本项目用到的两种写法：相对路径与 @fbkworks/* 包路径。
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const packageCss = {
  '@fbkworks/tokens/css': 'packages/tokens/src/css/tokens.css',
  '@fbkworks/tokens/dark.css': 'packages/tokens/src/css/dark.css',
  /* chart-core 的样式被 dashboard / screen 的聚合入口 @import，
     必须在这里登记，否则 bundle-css 会抛「未登记的包路径」。 */
  '@fbkworks/chart-core/style.css': 'packages/chart-core/src/style.css',
}

const IMPORT_RE = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g

async function inline(entry, seen = new Set()) {
  const abs = entry.startsWith('@')
    ? resolve(root, packageCss[entry] ?? '')
    : resolve(entry)

  if (seen.has(abs)) return ''
  seen.add(abs)

  const source = await readFile(abs, 'utf8')
  const parts = []

  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1]
    if (specifier.startsWith('@fbkworks/') && !packageCss[specifier]) {
      throw new Error(`[bundle-css] 未登记的包路径：${specifier}（${abs}）`)
    }
    parts.push(await inline(specifier.startsWith('@') ? specifier : resolve(dirname(abs), specifier), seen))
  }

  parts.push(source.replace(IMPORT_RE, '').trim())
  return parts.filter(Boolean).join('\n\n')
}

const [entryArg, outArg] = process.argv.slice(2)

if (!entryArg || !outArg) {
  console.error('usage: node scripts/bundle-css.mjs <entry.css> <out.css>')
  process.exit(1)
}

const entryAbs = resolve(entryArg)
const outAbs = resolve(outArg)
const css = await inline(entryAbs)

await mkdir(dirname(outAbs), { recursive: true })
await writeFile(outAbs, `${css}\n`, 'utf8')
console.log(`[bundle-css] ${entryAbs} -> ${outAbs}`)
