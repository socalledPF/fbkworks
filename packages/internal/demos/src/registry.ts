import { defineAsyncComponent, type Component } from 'vue'

/** Demo 分组。侧边栏按这个顺序渲染 */
export const DEMO_GROUPS = ['表格', '表单', '数据展示', '反馈', '数据看板', '可视化大屏'] as const

export type DemoGroup = (typeof DEMO_GROUPS)[number]

export interface DemoEntry {
  title: string
  /** 所属分组，决定侧边栏里的位置 */
  group: DemoGroup
  /** 一句话说明：这个 demo 想让人看什么 */
  description: string
  component: Component
}

/**
 * 文档站与 Playground 共用同一个注册表。
 * 同一份 .vue 同时被两边编译，从机制上消除“文档示例过期”。
 */
export const demos: Record<string, DemoEntry> = {
  'pro-table/basic': {
    title: '基础表格',
    group: '表格',
    description: '分页、排序、状态标签与数值格式化的典型列表页。',
    component: defineAsyncComponent(() => import('./pro-table/basic.vue')),
  },
  'pro-table/with-query': {
    title: '查询表单 + 表格联动',
    group: '表格',
    description: '查询表单与表格联动：条件变化后自动回到第一页重新请求。',
    component: defineAsyncComponent(() => import('./pro-table/with-query.vue')),
  },
  'pro-table/selection': {
    title: '多选与批量操作',
    group: '表格',
    description: '多选、全选与批量操作条的出现时机。',
    component: defineAsyncComponent(() => import('./pro-table/selection.vue')),
  },
  'query-form/basic': {
    title: '基础查询表单',
    group: '表单',
    description: '响应式栅格的查询表单，支持折叠展开。',
    component: defineAsyncComponent(() => import('./query-form/basic.vue')),
  },
  'form-generator/basic': {
    title: '基础表单生成器',
    group: '表单',
    description: '由 schema 驱动生成表单，含字段依赖与禁用联动。',
    component: defineAsyncComponent(() => import('./form-generator/basic.vue')),
  },
  'page-container/basic': {
    title: '页面容器 + 描述列表',
    group: '数据展示',
    description: '页面容器：标题、面包屑、返回按钮与内容区。',
    component: defineAsyncComponent(() => import('./page-container/basic.vue')),
  },
  'crud-page/basic': {
    title: 'CRUD 页面（查询 + 表格联动）',
    group: '表格',
    description: '查询区 + 表格 + 批量操作 + 弹窗表单的组合页。',
    component: defineAsyncComponent(() => import('./crud-page/basic.vue')),
  },
  'form-modal/basic': {
    title: '弹窗表单',
    group: '表单',
    description: '弹窗内嵌表单，提交成功后自动关闭并回调。',
    component: defineAsyncComponent(() => import('./form-modal/basic.vue')),
  },
  'result/basic': {
    title: '异常状态页',
    group: '数据展示',
    description: '成功、警告、错误、403/404/500 等状态页。',
    component: defineAsyncComponent(() => import('./result/basic.vue')),
  },
  'descriptions/basic': {
    title: '分组详情',
    group: '数据展示',
    description: '描述列表：分组、折叠与自定义渲染。',
    component: defineAsyncComponent(() => import('./descriptions/basic.vue')),
  },
  'dashboard/basic': {
    title: '数据看板',
    group: '数据看板',
    description: '指标卡、趋势图、环形图与排行榜组合成的数据看板。',
    component: defineAsyncComponent(() => import('./dashboard/basic.vue')),
  },
  'screen/basic': {
    title: '可视化大屏',
    group: '可视化大屏',
    description: '1920×1080 等比缩放的科技蓝大屏，8 个面板。',
    component: defineAsyncComponent(() => import('./screen/basic.vue')),
  },
  'feedback/basic': {
    title: '命令式反馈',
    group: '反馈',
    description: '命令式调用的消息提示与确认框。',
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

/** 按分组组织后的 demo 列表，供侧边栏渲染 */
export const demosByGroup = DEMO_GROUPS.map((group) => ({
  group,
  items: demoIds
    .filter((id) => demos[id]!.group === group)
    .map((id) => ({ id, ...demos[id]! })),
})).filter((g) => g.items.length > 0)

export function getDemo(id: string): DemoEntry | undefined {
  return demos[id]
}

export function getDemoSource(id: string): string | undefined {
  return demoSources[id]
}
