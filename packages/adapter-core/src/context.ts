import { inject, type InjectionKey, type Ref } from 'vue'
import type { FbkTokens } from '@fbk/tokens'
import type { Size } from './contracts/primitives'
import type { ThemeMode } from './contracts/theme'
import type { UiAdapter } from './contracts/adapter'
import { NOOP_REPORTER, type FbkReporter } from './observability'

export interface AdapterContext {
  adapter: UiAdapter
  themeMode: Ref<ThemeMode>
  setThemeMode: (mode: ThemeMode) => void
  locale: Ref<string>
  size: Ref<Size>
  tokens: FbkTokens
  /** 统一上报出口。未配置时是 noop，调用方不需要判空 */
  reporter: FbkReporter
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

/**
 * 取上报器。
 *
 * 不在 Provider 下时返回 noop 而不是抛错 —— 上报是可选能力，
 * 组件在独立使用（无 Provider）时不该因为它而崩溃。
 */
export function useReporter(): FbkReporter {
  return useAdapterContext()?.reporter ?? NOOP_REPORTER
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
