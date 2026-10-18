import { cp, mkdir, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

const [srcArg, distArg] = process.argv.slice(2)

if (!srcArg || !distArg) {
  console.error('usage: node scripts/copy-css.mjs <srcDir> <distDir>')
  process.exit(1)
}

const srcRoot = resolve(srcArg)
const distRoot = resolve(distArg)

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(path)
      continue
    }
    if (!path.endsWith('.css')) continue
    const dest = join(distRoot, relative(srcRoot, path))
    await mkdir(dirname(dest), { recursive: true })
    await cp(path, dest)
  }
}

await walk(srcRoot)
console.log(`[copy-css] ${srcRoot} -> ${distRoot}`)
