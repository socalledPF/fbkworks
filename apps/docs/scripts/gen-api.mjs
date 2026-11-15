import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import { createCheckerByJson } from 'vue-component-meta'

/**
 * 用 vue-component-meta 从 SFC 提取 props / events / slots / exposed，
 * 生成 apps/docs/.vitepress/theme/generated/api.json。
 *
 * 为什么不用手写 API 表格：手写表格三个月后必然和代码对不上。
 * 泛型 SFC 的类型推导由 vue-tsc 负责，这里只是把结果序列化。
 */

const root = resolve(import.meta.dirname, '../../..')
const tsconfigPath = resolve(root, 'packages/components/tsconfig.json')
const outFile = resolve(root, 'apps/docs/.vitepress/theme/generated/api.json')

const components = {
  ProTable: 'packages/components/src/pro-table/ProTable.vue',
  QueryForm: 'packages/components/src/query-form/QueryForm.vue',
  FormGenerator: 'packages/components/src/form-generator/FormGenerator.vue',
  PageContainer: 'packages/components/src/page-container/PageContainer.vue',
  Descriptions: 'packages/components/src/descriptions/Descriptions.vue',
}

// packages/components/tsconfig.json 里 extends 的是相对路径，直接喂给
// vue-component-meta 时它会用错误的工作目录解析，所以先展开成自包含的配置。
const baseConfig = ts.readConfigFile(resolve(root, 'tsconfig.base.json'), ts.sys.readFile)
const componentConfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile)

const compilerOptions = {
  ...(baseConfig.config?.compilerOptions ?? {}),
  ...(componentConfig.config?.compilerOptions ?? {}),
  // paths 必须相对 root 展开，否则解析不到 workspace 源码
  baseUrl: root,
  paths: baseConfig.config?.compilerOptions?.paths ?? {},
}

const checker = createCheckerByJson(root, {
  include: [
    'packages/components/src/**/*.ts',
    'packages/components/src/**/*.tsx',
    'packages/components/src/**/*.vue',
    'packages/adapter-core/src/**/*.ts',
    'packages/shared/src/**/*.ts',
    'packages/tokens/src/**/*.ts',
  ],
  compilerOptions,
})

function serializeType(type) {
  if (!type) return ''
  return type.replace(/\s+/g, ' ').trim()
}

// SFC 上会被 Vue 自动注入的 props，不属于公开 API，文档里不该出现
const VUE_BUILTIN_PROPS = new Set(['key', 'ref', 'ref_for', 'ref_key', 'class', 'style'])

const isBuiltinProp = (name) => VUE_BUILTIN_PROPS.has(name) || name.startsWith('onVue:')

function pick(list, kind) {
  return list
    .filter((item) => !(kind === 'prop' && isBuiltinProp(item.name)))
    .map((item) => ({
      name: item.name,
      type: serializeType(item.type),
      default: item.default ?? '',
      required: Boolean(item.required),
      description: item.description ?? '',
      kind,
    }))
}

/**
 * vue-component-meta 对 **generic SFC**（`<script setup generic="T extends ...">`）
 * 提取不到 defineExpose —— 于是 ProTable / FormGenerator / Descriptions 的
 * 「暴露方法」表渲染成一行「无」，而同一页正文正在教用户调 validate() / reload()。
 *
 * 兜底静态读源码：defineExpose 的参数是对象字面量，成员按 2 空格缩进排列，
 * 正则足够且不会误报；工具能提到时用工具的，提不到才补。
 */
/**
 * 动态插槽名（`item-<key>` 这类）不在组件类型里，vue-component-meta 提不到，
 * 于是 Descriptions 的插槽表渲染成一行「无」—— 而同一页正文在讲 item-<key>。
 *
 * 两个坑（都实测过）：
 *   1. $ 必须转义成 \$ —— 不转义它是「行尾」锚点，整条正则永远匹配不到；
 *   2. 只认 :name="`xx-${...}`" 这种绑定 —— 宽泛的「xx-${」会把 CSS 类名模板
 *      （`fbk-descriptions--gap-${x}`）也当成插槽，给每个组件塞一条假条目。
 */
const DYNAMIC_SLOT_RE = new RegExp(
  ':name="' + String.fromCharCode(96) + '([a-z][a-z-]*)-' + String.fromCharCode(92) + String.fromCharCode(36) + String.fromCharCode(123),
  'g',
)

function dynamicSlotsFromSource(file) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const found = new Set()
  for (const match of source.matchAll(DYNAMIC_SLOT_RE)) found.add(match[1] + '-<dynamic>')
  return [...found].map((name) => ({
    name,
    type: 'unknown',
    default: '',
    required: false,
    description: '动态插槽名（工具链提取不到，按源码里的模板字符串补）',
    kind: 'slot',
  }))
}
function exposedFromSource(file) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const block = /defineExpose[^(]*\(\s*\{([\s\S]*?)\}\s*\)/.exec(source)
  if (!block) return []
  const lines = block[1].split(new RegExp(String.fromCharCode(10)))
  return lines
    .map((line) => {
      const hit = /^ {2}([A-Za-z_$][\w$]*)[ ]*[,:]/.exec(line)
      return hit ? hit[1] : undefined
    })
    .filter(Boolean)
    .map((name) => ({
      name,
      type: '() => unknown',
      default: '',
      required: false,
      description: '',
      kind: 'exposed',
    }))
}
const output = {}

for (const [name, file] of Object.entries(components)) {
  try {
    const meta = checker.getComponentMeta(resolve(root, file))
    output[name] = {
      props: pick(meta.props, 'prop'),
      events: pick(meta.events, 'event'),
      slots: [...pick(meta.slots, 'slot'), ...dynamicSlotsFromSource(file)],
      exposed: (() => {
        const list = pick(meta.exposed, 'exposed')
        return list.length ? list : exposedFromSource(file)
      })(),
    }
    console.warn(`[gen-api] ${name}: ${meta.props.length} props, ${meta.events.length} events`)
  } catch (error) {
    console.error(`[gen-api] ${name} 解析失败：${error.message}`)
    output[name] = { props: [], events: [], slots: [], exposed: [] }
  }
}

await mkdir(dirname(outFile), { recursive: true })
await writeFile(outFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.warn(`[gen-api] 已写入 ${outFile}`)
