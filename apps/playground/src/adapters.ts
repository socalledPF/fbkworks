import type { UiAdapter } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
import { vantAdapter } from '@fbkworks/adapter-vant'
import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'

/** Playground 是唯一允许同时依赖三个适配器的应用（不发布）。 */
export const adapters: Record<string, UiAdapter> = {
  'element-plus': elementPlusAdapter,
  'naive-ui': naiveUiAdapter,
  vant: vantAdapter,
}

export type AdapterName = keyof typeof adapters

export const adapterNames = Object.keys(adapters) as AdapterName[]
