import type { Component } from 'vue'
import type { ThemeBridge } from './theme'

/**
 * 适配器契约版本。core 在安装时校验，不匹配直接抛错。
 * P0 结束后冻结为 1；破坏性变更必须提升此值并写迁移指南。
 */
export const ADAPTER_API_VERSION = 1

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
  Form: Component
  FormItem: Component
  DataGrid: Component
  Pagination: Component
  Dialog: Component
  Tag: Component
  Empty: Component
  Spin: Component
}

export interface UiAdapter {
  meta: AdapterMeta
  capabilities: Capabilities
  primitives: UiPrimitives
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
    'Form',
    'FormItem',
    'DataGrid',
    'Pagination',
    'Dialog',
    'Tag',
    'Empty',
    'Spin',
  ]
  const missing = required.filter((key) => !adapter.primitives?.[key])
  if (missing.length) {
    throw new Error(`[fbk] 适配器 "${adapter.meta.name}" 缺少原语：${missing.join(', ')}。`)
  }
  if (!adapter.RootProvider) {
    throw new Error(`[fbk] 适配器 "${adapter.meta.name}" 缺少 RootProvider。`)
  }
}
