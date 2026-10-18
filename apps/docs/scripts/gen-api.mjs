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

const output = {}

for (const [name, file] of Object.entries(components)) {
  try {
    const meta = checker.getComponentMeta(resolve(root, file))
    output[name] = {
      props: pick(meta.props, 'prop'),
      events: pick(meta.events, 'event'),
      slots: pick(meta.slots, 'slot'),
      exposed: pick(meta.exposed, 'exposed'),
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
