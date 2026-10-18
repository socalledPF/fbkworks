import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'

/**
 * 校验文档里的 Mermaid 图语法。
 *
 * 为什么需要：Mermaid 在构建期不解析图，语法错误只在浏览器里显示成一块红色报错，
 * 而 docs:build 依然成功。这个脚本在 CI 里提前拦住。
 */

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.SVGElement = dom.window.SVGElement
globalThis.Node = dom.window.Node
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

const mermaid = (await import('mermaid')).default
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })

const docsRoot = resolve(import.meta.dirname, '..')

async function collectMarkdown(dir) {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collectMarkdown(path)))
    else if (path.endsWith('.md')) files.push(path)
  }
  return files
}

const DIAGRAM_RE = /```mermaid\n([\s\S]*?)```/g

let total = 0
let bad = 0

for (const file of await collectMarkdown(docsRoot)) {
  const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n')
  const blocks = [...source.matchAll(DIAGRAM_RE)].map((match) => match[1])

  for (const [index, code] of blocks.entries()) {
    total += 1
    try {
      await mermaid.parse(code)
    } catch (error) {
      bad += 1
      console.warn(
        `[mermaid] FAIL ${file.replace(docsRoot, '')} #${index + 1}: ${error.message.split('\n')[0]}`,
      )
    }
  }
}

console.warn(`[mermaid] ${total - bad}/${total} 张图语法正确`)
process.exit(bad ? 1 : 0)
