import { inject, type InjectionKey, type Ref } from 'vue'
import type { FbkTokens } from '@fbk/tokens'
import type { Size } from './contracts/primitives'
import type { ThemeMode } from './contracts/theme'
import type { UiAdapter } from './contracts/adapter'

export interface AdapterContext {
  adapter: UiAdapter
  themeMode: Ref<ThemeMode>
  setThemeMode: (mode: ThemeMode) => void
  locale: Ref<string>
  size: Ref<Size>
  tokens: FbkTokens
}

/**
 * 使用 Symbol.for 而不是 Symbol()：即使 pnpm 提升导致出现两份 adapter-core，
 * 注册表键仍然相同，provide/inject 不会断。
 */
export const ADAPTER_CONTEXT = Symbol.for('fbk.adapter.context') as unknown as InjectionKey<
  AdapterContext
>

export function useAdapterContext(): AdapterContext | null {
  return inject(ADAPTER_CONTEXT, null)
}

export function useAdapter(): UiAdapter {
  const ctx = useAdapterContext()
  if (!ctx) {
    throw new Error(
      '[fbk] 未找到 UI 适配器。请在应用入口执行：\n' +
        "  app.use(createBusinessKit({ adapter: elementPlusAdapter }))\n" +
        '或在局部使用：<FbkProvider :adapter="adapter">。\n' +
        '文档：/guide/adapters',
    )
  }
  return ctx.adapter
}

export function useAdapterCapabilities() {
  return useAdapter().capabilities
}

export function useFbkTheme() {
  const ctx = useAdapterContext()
  if (!ctx) throw new Error('[fbk] useFbkTheme() 必须在 FbkProvider 或 createBusinessKit 下使用。')
  return {
    mode: ctx.themeMode,
    setMode: ctx.setThemeMode,
    locale: ctx.locale,
    size: ctx.size,
  }
}
