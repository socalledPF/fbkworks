import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'

/**
 * 把 dist 里 .d.ts 的相对说明符改写成 node16/nodenext 能解析的形式。
 *
 * 需要处理两件事：
 * 1. 无扩展名的说明符（`./primitives/Button`）→ 补 `.js`，TS 会映射到同名 `.d.ts`。
 * 2. 指向目录的说明符（`./pro-table` → `dist/pro-table/index.d.ts`）→ 改成 `./pro-table/index.js`。
 *    ESM 解析不做目录索引查找，不改写的话消费者用 node16 会直接报错。
 */

const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.[^'"]*)['"]/g

const isDeclarationless = (specifier: string) => {
  const ext = extname(specifier)
  return ext === '' || ext === '.ts' || ext === '.tsx' || ext === '.vue'
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function resolveSpecifier(specifier: string, fromFile: string) {
  const clean = specifier.replace(/\.(ts|tsx|vue)$/, '')
  const abs = resolve(dirname(fromFile), clean)

  if (await exists(join(abs, 'index.d.ts'))) return `${clean}/index.js`
  return `${clean}.js`
}

export async function rewriteDtsSpecifiers(code: string, fromFile: string) {
  const matches = [...code.matchAll(SPECIFIER_RE)]
  if (!matches.length) return code

  let next = ''
  let cursor = 0
  for (const match of matches) {
    const full = match[0]
    const prefix = match[1]
    const specifier = match[2]
    if (!isDeclarationless(specifier)) continue
    const replacement = `${prefix}'${await resolveSpecifier(specifier, fromFile)}'`
    next += code.slice(cursor, match.index) + replacement
    cursor = (match.index ?? 0) + full.length
  }
  return next + code.slice(cursor)
}

async function walk(dir: string): Promise<number> {
  let changed = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      changed += await walk(path)
      continue
    }
    if (!path.endsWith('.d.ts')) continue
    const source = await readFile(path, 'utf8')
    const next = await rewriteDtsSpecifiers(source, path)
    if (next !== source) {
      await writeFile(path, next, 'utf8')
      changed += 1
    }
  }
  return changed
}

export async function fixDtsImports(distDir: string): Promise<number> {
  return walk(distDir)
}
