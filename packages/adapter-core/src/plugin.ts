import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  ref,
  watchEffect,
  type App,
  type Component,
  type PropType,
  type Plugin,
} from 'vue'
import { defaultTokens, type FbkTokens } from '@fbk/tokens'
import { warnOnce } from '@fbk/shared'
import { assertAdapterCompatible, type UiAdapter } from './contracts/adapter'
import type { Size } from './contracts/primitives'
import type { ThemeMode } from './contracts/theme'
import { ADAPTER_CONTEXT, type AdapterContext } from './context'

export interface BusinessKitOptions {
  adapter: UiAdapter
  theme?: ThemeMode
  locale?: string
  size?: Size
  tokens?: FbkTokens
  /** 显式注册为全局组件；默认不注册，保证 tree-shaking */
  components?: Array<{ name: string; component: Component }>
}

/**
 * 把 `system` 解析成具体的明暗档位。
 *
 * 注意 `cyber` 会被**原样保留**，不降级成 dark —— 它需要写成
 * `data-fbk-theme="cyber"` 才能命中 cyber.css 的选择器。
 * 需要明暗布尔值的适配器自己用 `THEME_IS_DARK` 判断。
 */
function resolveTheme(mode: ThemeMode): Exclude<ThemeMode, 'system'> {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function createAdapterContext(options: BusinessKitOptions): AdapterContext {
  const { adapter } = options
  const tokens = options.tokens ?? defaultTokens
  const themeMode = ref<ThemeMode>(options.theme ?? 'light')
  const locale = ref(options.locale ?? 'zh-CN')
  const size = ref<Size>(options.size ?? 'md')

  const applyTheme = (mode: ThemeMode) => {
    const resolved = resolveTheme(mode)
    adapter.theme.apply(resolved, tokens)
  }

  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode
    applyTheme(mode)
  }

  return { adapter, themeMode, setThemeMode, locale, size, tokens }
}

export function createBusinessKit(options: BusinessKitOptions): Plugin {
  return {
    install(app: App) {
      assertAdapterCompatible(options.adapter)
      const ctx = createAdapterContext(options)
      app.provide(ADAPTER_CONTEXT, ctx)
      app.config.globalProperties.$fbk = ctx

      ctx.setThemeMode(ctx.themeMode.value)

      for (const item of options.components ?? []) app.component(item.name, item.component)

      if (options.adapter.capabilities.theme.provider) {
        warnOnce(
          'provider-theme',
          `适配器 "${options.adapter.meta.name}" 使用 provider 型主题，` +
            '请在根节点包裹 <FbkProvider>，否则暗色模式不会生效。',
        )
      }
    },
  }
}

/**
 * 局部注入 / 微前端 / Playground 切换适配器。
 * `:key` 变化时整个子树重建，避免旧适配器的 DOM 状态残留。
 */
export const FbkProvider = defineComponent({
  name: 'FbkProvider',
  props: {
    adapter: { type: Object as PropType<UiAdapter>, default: undefined },
    theme: { type: String as PropType<ThemeMode>, default: undefined },
    locale: { type: String, default: undefined },
    size: { type: String as PropType<Size>, default: undefined },
    tokens: { type: Object as PropType<FbkTokens>, default: undefined },
  },
  setup(props, { slots }) {
    const parent = inject(ADAPTER_CONTEXT, null)
    const adapter = props.adapter ?? parent?.adapter
    if (!adapter) {
      throw new Error('[fbk] <FbkProvider> 需要 adapter prop 或上层已提供 adapter。')
    }
    assertAdapterCompatible(adapter)

    const ctx = createAdapterContext({
      adapter,
      theme: props.theme ?? parent?.themeMode.value ?? 'light',
      locale: props.locale ?? parent?.locale.value ?? 'zh-CN',
      size: props.size ?? parent?.size.value ?? 'md',
      tokens: props.tokens ?? parent?.tokens ?? defaultTokens,
    })
    provide(ADAPTER_CONTEXT, ctx)

    watchEffect(() => {
      ctx.adapter.theme.apply(resolveTheme(ctx.themeMode.value), ctx.tokens)
    })

    const providerProps = computed(() => {
      const mode = resolveTheme(ctx.themeMode.value)
      return ctx.adapter.theme.providerProps?.(mode, ctx.tokens) ?? {}
    })

    return () => {
      const Root = ctx.adapter.RootProvider
      return h(
        Root,
        {
          ...providerProps.value,
          mode: resolveTheme(ctx.themeMode.value),
          tokens: ctx.tokens,
          locale: ctx.locale.value,
          size: ctx.size.value,
        },
        slots,
      )
    }
  },
})
