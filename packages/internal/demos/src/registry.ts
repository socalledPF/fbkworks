import { defineAsyncComponent, type Component } from 'vue'

export interface DemoEntry {
  title: string
  component: Component
}

/**
 * 文档站与 Playground 共用同一个注册表。
 * 同一份 .vue 同时被两边编译，从机制上消除“文档示例过期”。
 */
export const demos: Record<string, DemoEntry> = {
  'pro-table/basic': {
    title: '基础表格',
    component: defineAsyncComponent(() => import('./pro-table/basic.vue')),
  },
  'pro-table/with-query': {
    title: '查询表单 + 表格联动',
    component: defineAsyncComponent(() => import('./pro-table/with-query.vue')),
  },
  'pro-table/selection': {
    title: '多选与批量操作',
    component: defineAsyncComponent(() => import('./pro-table/selection.vue')),
  },
  'query-form/basic': {
    title: '基础查询表单',
    component: defineAsyncComponent(() => import('./query-form/basic.vue')),
  },
  'form-generator/basic': {
    title: '基础表单生成器',
    component: defineAsyncComponent(() => import('./form-generator/basic.vue')),
  },
  'page-container/basic': {
    title: '页面容器 + 描述列表',
    component: defineAsyncComponent(() => import('./page-container/basic.vue')),
  },
  'crud-page/basic': {
    title: 'CRUD 页面（查询 + 表格联动）',
    component: defineAsyncComponent(() => import('./crud-page/basic.vue')),
  },
  'form-modal/basic': {
    title: '弹窗表单',
    component: defineAsyncComponent(() => import('./form-modal/basic.vue')),
  },
  'result/basic': {
    title: '异常状态页',
    component: defineAsyncComponent(() => import('./result/basic.vue')),
  },
  'descriptions/basic': {
    title: '分组详情',
    component: defineAsyncComponent(() => import('./descriptions/basic.vue')),
  },
  'dashboard/basic': {
    title: '数据看板',
    component: defineAsyncComponent(() => import('./dashboard/basic.vue')),
  },
  'screen/basic': {
    title: '可视化大屏',
    component: defineAsyncComponent(() => import('./screen/basic.vue')),
  },
  'feedback/basic': {
    title: '命令式反馈',
    component: defineAsyncComponent(() => import('./feedback-basic.vue')),
  },
}

// Vite 的 import.meta.glob 类型来自 vite/client，这里做最小声明以免依赖构建工具类型
interface ImportMetaGlob {
  glob: (
    pattern: string,
    options: { query: string; import: string; eager: true },
  ) => Record<string, unknown>
}

const sources = (import.meta as unknown as ImportMetaGlob).glob('./**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const demoSources: Record<string, string> = Object.fromEntries(
  Object.entries(sources).map(([path, source]) => [
    path.replace(/^\.\//, '').replace(/\.vue$/, ''),
    source as string,
  ]),
)

export const demoIds = Object.keys(demos)

export function getDemo(id: string): DemoEntry | undefined {
  return demos[id]
}

export function getDemoSource(id: string): string | undefined {
  return demoSources[id]
}
