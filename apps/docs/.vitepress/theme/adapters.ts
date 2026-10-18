import type { UiAdapter } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import { vantAdapter } from '@fbk/adapter-vant'
import { naiveUiAdapter } from '@fbk/adapter-naive-ui'

/**
 * 文档站与 Playground 一样，是唯一允许同时依赖三个适配器的应用（不发布）。
 * 业务应用只需要安装自己用到的那个。
 */
export const adapters = {
  'element-plus': elementPlusAdapter,
  'naive-ui': naiveUiAdapter,
  vant: vantAdapter,
} satisfies Record<string, UiAdapter>

export type AdapterName = keyof typeof adapters

export const adapterNames = Object.keys(adapters) as AdapterName[]
