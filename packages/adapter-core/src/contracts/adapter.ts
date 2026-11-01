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
 * 版本 3：新增 Drawer 原语（详情抽屉）。
 *
 * Drawer 随后被改为**可选**（见 docs/design/2026-10-28-optional-primitive-layer.md），
 * 版本号**没有**因此提升 —— 把必填改为可选是更宽松的约束：已有的 v3 适配器仍然通过，
 * 之前不被允许的（无 Drawer）现在通过。没有任何适配器因这次改动而失败。
 *
 * 由此确立的判据：
 *   新增原语会破版（旧适配器缺成员 → 启动即失败），减少约束不会。
 * 所以「新增」应走可选层，「移除」不需要动版本号。
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
  /**
   * 可选原语。缺了只影响 FbkDetailDrawer，库的其余部分完全正常。
   * 缺失时 FbkDetailDrawer 在 mount 阶段抛错并指向 FbkDetailPage —— 见 requirePrimitive。
   */
  Drawer?: Component
  Tag: Component
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

/**
 * 取一个**可选**原语；缺失时抛出带替代方案的错误。
 *
 * 为什么不是降级：降级是「看起来能用、行为不同」，报错是「明确告诉你用不了、并给你出路」。
 * 项目原则是显式失败优于静默降级。
 */
export function requirePrimitive<K extends keyof UiPrimitives>(
  adapter: UiAdapter,
  key: K,
  alternative: string,
): NonNullable<UiPrimitives[K]> {
  const primitive = adapter.primitives?.[key]
  if (!primitive) {
    throw new Error(
      `[fbk] 适配器「${adapter.meta?.name ?? 'unknown'}」没有提供 ${String(key)} 原语，该组件不可用。` +
        alternative,
    )
  }
  return primitive as NonNullable<UiPrimitives[K]>
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
    'Tag',
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
