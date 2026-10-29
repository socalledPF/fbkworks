import type { Component } from 'vue'
import type { ThemeBridge } from './theme'
import type { FeedbackApi } from './feedback'

/**
 * 适配器契约版本。core 在安装时校验，不匹配直接抛错。
 *
 * 版本 2：新增 DatePicker / Radio 原语与 `feedback` 命令式 API。
 * 三者都是**必填**，旧适配器缺少它们会在启动时被 assertAdapterCompatible
 * 拦下，因此属于破坏性变更 —— 版本号必须提升。
 *
 * 版本 3：新增 Drawer 原语（详情抽屉）。它同样是**必填**，旧适配器缺少它会在
 * 启动时被 assertAdapterCompatible 拦下，因此属于破坏性变更 —— 版本号必须提升。
 * 设为可选的代价更大：可选意味着 FbkDetailDrawer 必须准备降级路径，
 * 而每一种降级都是「用户以为能用、实际表现不同」（见设计稿 §二之一）。
 */
export const ADAPTER_API_VERSION = 3

export interface AdapterMeta {
  apiVersion: number
  /** 'element-plus' | 'vant' | 'naive-ui' | 自定义 */
  name: string
  /** 适配器包版本 */
  version: string
  uiLibrary: { name: string; version: string }
  platform: 'desktop' | 'mobile'
}

export interface Capabilities {
  dataGrid: {
    presentation: 'table' | 'cards' | 'responsive'
    selection: boolean
    sort: 'client' | 'custom' | 'none'
    expandable: boolean
    tree: boolean
    virtualScroll: boolean
    stickyHeader: boolean
  }
  form: {
    layout: 'horizontal' | 'vertical' | 'inline' | 'responsive'
    labelWidth: boolean
    validateOn: Array<'change' | 'blur' | 'submit'>
    asyncValidator: boolean
  }
  overlay: {
    kind: 'dialog' | 'drawer' | 'popup'
    supportsDrawer: boolean
    supportsTeleport: boolean
  }
  pagination: {
    mode: 'pages' | 'infinite' | 'both'
    pageSizes: boolean
    jumper: boolean
  }
  feedback: {
    message: boolean
    notification: boolean
    confirm: boolean
    loading: boolean
  }
  theme: {
    darkMode: boolean
    cssVariables: boolean
    provider: boolean
  }
  /** 细粒度可选能力，业务组件按 key 探测 */
  features: Record<string, boolean>
}

/**
 * 原语表。业务组件只通过 `adapter.primitives.X` 渲染，禁止直接 import UI 库。
 * 每个原语都是普通 Vue 组件，props 契约见 contracts/primitives.ts。
 */
export interface UiPrimitives {
  Button: Component
  Input: Component
  Select: Component
  /**
   * 布尔开关（`switch` / `checkbox` 字段）。
   * 不提供它的话，业务组件只能渲染原生 `<input type="checkbox">` ——
   * 那会在三个适配器下长出三种样子，而这正是适配层要消除的。
   */
  Checkbox: Component
  /**
   * 日期/时间选择。
   * 不提供它，`type: 'date'` 的字段只能渲染成普通文本框 ——
   * 用户看到的是一个能随便输入的框，而不是日期选择器。
   */
  DatePicker: Component
  /** 单选组。`type: 'radio'` 的字段用它，而不是静默降级成文本框。 */
  Radio: Component
  Form: Component
  FormItem: Component
  DataGrid: Component
  Pagination: Component
  Dialog: Component
  /**
   * 抽屉。与 Dialog 分开：它是「从一侧滑出、承载详情内容」的容器，
   * 不是打断当前操作的模态框。缺了它，详情只能挤进 Dialog 或退回普通页。
   */
  Drawer: Component
  Tag: Component
  Empty: Component
  Spin: Component
}

export interface UiAdapter {
  meta: AdapterMeta
  capabilities: Capabilities
  primitives: UiPrimitives
  /**
   * 命令式反馈 API（消息提示 / 确认框）。
   * 不放在 primitives 里：那不是组件，调用方式完全不同。
   */
  feedback: FeedbackApi
  /** 承载 locale / theme / size 的根组件 */
  RootProvider: Component
  theme: ThemeBridge
}

export function assertAdapterCompatible(adapter: UiAdapter): void {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('[fbk] adapter 必须是 UiAdapter 对象。')
  }
  if (adapter.meta?.apiVersion !== ADAPTER_API_VERSION) {
    throw new Error(
      `[fbk] 适配器 "${adapter.meta?.name ?? 'unknown'}" 的 apiVersion 为 ` +
        `${adapter.meta?.apiVersion ?? 'undefined'}，当前 core 要求 ${ADAPTER_API_VERSION}。` +
        '请升级适配器包。',
    )
  }
  const required: Array<keyof UiPrimitives> = [
    'Button',
    'Input',
    'Select',
    'Checkbox',
    'DatePicker',
    'Radio',
    'Form',
    'FormItem',
    'DataGrid',
    'Pagination',
    'Dialog',
    'Drawer',
    'Tag',
    'Empty',
    'Spin',
  ]
  const missing = required.filter((key) => !adapter.primitives?.[key])
  if (missing.length) {
    throw new Error(`[fbk] 适配器 "${adapter.meta.name}" 缺少原语：${missing.join(', ')}。`)
  }
  if (!adapter.feedback?.message || !adapter.feedback?.confirm) {
    throw new Error(`[fbk] 适配器 "${adapter.meta.name}" 缺少 feedback（message / confirm）。`)
  }
  if (!adapter.RootProvider) {
    throw new Error(`[fbk] 适配器 "${adapter.meta.name}" 缺少 RootProvider。`)
  }
}
