import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  mergeProps,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect,
  type App,
  type Component,
  type PropType,
  type Plugin,
} from 'vue'
import { defaultTokens, toCssText, type FbkTokens } from '@fbk/tokens'
import { warnOnce } from '@fbk/shared'
import { assertAdapterCompatible, type UiAdapter } from './contracts/adapter'
import type { Size } from './contracts/primitives'
import type { ThemeMode } from './contracts/theme'
import { ADAPTER_CONTEXT, type AdapterContext } from './context'
import {
  PERMISSION_CONTEXT,
  type PermissionResolver,
} from './permission'
import { createPermissionDirective } from './permission-directive'
import {
  createReporter,
  type FbkErrorEvent,
  type FbkTelemetryEvent,
} from './observability'

export interface BusinessKitOptions {
  adapter: UiAdapter
  theme?: ThemeMode
  locale?: string
  size?: Size
  tokens?: FbkTokens
  /** 显式注册为全局组件；默认不注册，保证 tree-shaking */
  components?: Array<{ name: string; component: Component }>

  /**
   * 统一错误出口。不传则不采集（零开销）。
   *
   * 见 docs/design/2026-10-25-observability.md。
   */
  onError?: (event: FbkErrorEvent) => void

  /** 统一行为与性能事件出口。不传则不采集 */
  onTelemetry?: (event: FbkTelemetryEvent) => void

  /**
   * 当前用户的权限点。
   *
   * 传**函数**而不是数组：权限可能在登录后异步加载、也可能随用户切换变化。
   * 每次检查都调一次，天然响应式。
   *
   * 库不做「角色 → 权限点」的映射 —— 那是应用的用户体系。
   */
  permissions?: PermissionResolver
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

/**
 * `system` 档位的实时明暗。
 *
 * resolveTheme() 在 apply 时只读一次 matchMedia().matches 快照 —— 系统切换深浅色后
 * 界面不会跟随。这里把快照变成响应式，change 监听随组件卸载移除（须在 setup 内调用）。
 */
function useSystemDark() {
  const query =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  const prefersDark = ref(query?.matches ?? false)
  if (query) {
    const onChange = (event: MediaQueryListEvent) => {
      prefersDark.value = event.matches
    }
    query.addEventListener('change', onChange)
    onUnmounted(() => query.removeEventListener('change', onChange))
  }
  return prefersDark
}

/**
 * 正在挂载的 Provider 的主题写回函数，按挂载顺序入栈。
 *
 * 卸载时要把「仍然在挂载的那一个」重新 apply 回去：watchEffect 随 scope 一起停掉，
 * 少了这一步，data-fbk-theme 与 :root 变量会停在被卸载的档位上
 * （实测嵌套 [light, dark] 卸载内层后主题仍是 dark）。
 * 用栈而不是直接取 inject 到的父级：兄弟 Provider 并存时（微前端 / 多根 / Playground），
 * 卸载其中一个不该把另一个正在生效的档位一起抹掉。
 */
const mountedProviders: Array<() => void> = []

function applyContextTheme(ctx: AdapterContext): void {
  ctx.adapter.theme.apply(resolveTheme(ctx.themeMode.value), ctx.tokens)
}

/**
 * 自定义令牌的样式表。**用 cssText 写 <style>，不往根元素写行内变量**：
 * 行内变量（element.style.setProperty）会无条件压过 dark.css / cyber.css 的
 * html[data-fbk-theme] 规则，主题切换直接失效（checkpoint §6.7）。
 * 写 <style> 则与其它 CSS 同源：基础令牌与 tokens.css 同为 :root，靠文档顺序取胜；
 * 主题覆盖的 html[data-fbk-theme] 特异性更高，仍然胜出。
 *
 * 固定 id 并复用同一个元素 —— 重复 install / 多个 Provider 只能有一个 <style>。
 */
const TOKEN_STYLE_ID = 'fbk-custom-tokens'

/** 自定义令牌层，按挂载顺序入栈；<style> 的内容永远是栈顶那一层 */
const tokenLayers: Array<{ text: string }> = []

function renderTokenStyle(): void {
  let style = document.getElementById(TOKEN_STYLE_ID) as HTMLStyleElement | null
  if (!tokenLayers.length) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = TOKEN_STYLE_ID
  }
  style.textContent = tokenLayers[tokenLayers.length - 1].text
  /* 每次插入都重新 append（移动而非复制）：同为 :root 时胜负只由文档顺序决定，
     而应用样式可能在我们之后才注入（HMR、异步 chunk），那时它会插到前面去。 */
  document.head.appendChild(style)
}

/** 入栈一层自定义令牌并返回撤销函数；没传 tokens 时什么都不做 */
function addTokenLayer(tokens: FbkTokens | undefined): (() => void) | undefined {
  // SSR 没有 DOM 可注入，也就不用入栈：否则层会随着每次请求在模块里堆起来
  if (!tokens || typeof document === 'undefined') return undefined
  const layer = { text: toCssText(tokens) }
  tokenLayers.push(layer)
  renderTokenStyle()
  return () => {
    const index = tokenLayers.indexOf(layer)
    if (index === -1) return
    tokenLayers.splice(index, 1)
    renderTokenStyle()
  }
}

export function createAdapterContext(options: BusinessKitOptions): AdapterContext {
  const { adapter } = options
  const tokens = options.tokens ?? defaultTokens
  const reporter = createReporter({ onError: options.onError, onTelemetry: options.onTelemetry })
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

  return { adapter, themeMode, setThemeMode, locale, size, tokens, reporter }
}

export function createBusinessKit(options: BusinessKitOptions): Plugin {
  return {
    install(app: App) {
      assertAdapterCompatible(options.adapter)
      const ctx = createAdapterContext(options)
      app.provide(ADAPTER_CONTEXT, ctx)

      /* 自定义令牌：只在**显式传了 tokens** 时注入 —— 默认令牌已经由 tokens.css
         编译进 CSS，重复注入只会多一份与主题同特异性竞争的声明。
         样式跟随 app 生命周期：app.onUnmount 撤掉，不留悬空的 <style>。 */
      const releaseTokens = addTokenLayer(options.tokens)
      if (releaseTokens) app.onUnmount(releaseTokens)

      /* 权限上下文与指令。
         没有 permissions 时也 provide —— 让指令统一走「无权限」分支，
         而不是因为 inject 失败而崩溃。 */
      const getPermissions: PermissionResolver = options.permissions ?? (() => [])
      app.provide(PERMISSION_CONTEXT, { getPermissions })
      app.directive('permission', createPermissionDirective(getPermissions))
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
  // attrs 由自己转发：隐式 fallthrough 只在「渲染根恰好是单个组件」时成立，
  // 一旦根结构变化就会静默失效，而这正是 RootProvider 侧丢 class 的同源缺陷。
  inheritAttrs: false,
  props: {
    adapter: { type: Object as PropType<UiAdapter>, default: undefined },
    theme: { type: String as PropType<ThemeMode>, default: undefined },
    locale: { type: String, default: undefined },
    size: { type: String as PropType<Size>, default: undefined },
    tokens: { type: Object as PropType<FbkTokens>, default: undefined },
    onError: { type: Function as PropType<(event: FbkErrorEvent) => void>, default: undefined },
    onTelemetry: {
      type: Function as PropType<(event: FbkTelemetryEvent) => void>,
      default: undefined,
    },
    permissions: {
      type: Function as PropType<PermissionResolver>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots }) {
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
      // 未传时继承上层，保证嵌套 Provider 不会意外关掉上报
      onError: props.onError ?? parent?.reporter.handlers.onError,
      onTelemetry: props.onTelemetry ?? parent?.reporter.handlers.onTelemetry,
    })
    provide(ADAPTER_CONTEXT, ctx)

    /* 同理只认**显式传入**的 tokens：继承来的那份由上层（插件 install 或外层
       Provider）负责注入，这里再注入一次就是同一份样式写两遍。
       卸载时撤掉自己这一层，栈顶回到外层或全局那份。 */
    const releaseTokens = addTokenLayer(props.tokens)
    if (releaseTokens) onUnmounted(releaseTokens)

    /* 权限上下文。
       未传时继承上层（插件 install 提供的那份），与 adapter/theme/locale 一致。
       早期这里直接退化成 () => []：外面 app.use 配好权限、里面套一个
       <FbkProvider>，权限判定就被清空成「全部无权限」了。
       都没有时才用空解析器 —— 统一走「无权限」分支，不崩。 */
    const parentPermission = inject(PERMISSION_CONTEXT, null)
    const getPermissions: PermissionResolver =
      props.permissions ?? parentPermission?.getPermissions ?? (() => [])
    provide(PERMISSION_CONTEXT, { getPermissions })

    /* 注册 v-permission 指令。
       必须在这里也注册：应用用 <FbkProvider> 而不是 app.use(createBusinessKit())
       时，指令不会走插件的 install，导致模板里报
       "Failed to resolve directive: permission" 且静默失效。
       但**已注册时不能再注册**：指令挂在 app 级指令表上，Vue 是「后注册顶掉
       先注册」且只 dev warn，多挂一个 Provider 就能把插件配的解析器换成
       () => []，按钮全部消失却没有报错。
       判重按 app 做（不能用模块级标记）：多 app 各有一份指令表，互不干扰。 */
    const app = getCurrentInstance()?.appContext.app
    if (app && !app.directive('permission')) {
      app.directive('permission', createPermissionDirective(getPermissions))
    }

    /*
     * theme / locale / size 三个 prop 必须与内部 ctx 保持同步。
     *
     * 早期只在 setup 时读一次 props.theme 传给 createAdapterContext，
     * 之后 props.theme 变化完全不生效 —— `<FbkProvider :theme="theme">`
     * 配合 v-model 切换主题时，界面纹丝不动。
     * 实测症状：切暗色后 data-fbk-theme 仍是 light、表格仍白底。
     */
    watch(
      () => props.theme,
      (next) => {
        if (next !== undefined) ctx.setThemeMode(next)
      },
    )
    watch(
      () => props.locale,
      (next) => {
        if (next !== undefined) ctx.locale.value = next
      },
    )
    watch(
      () => props.size,
      (next) => {
        if (next !== undefined) ctx.size.value = next
      },
    )

    const prefersDark = useSystemDark()
    const resolvedTheme = computed<Exclude<ThemeMode, 'system'>>(() =>
      ctx.themeMode.value === 'system'
        ? prefersDark.value
          ? 'dark'
          : 'light'
        : ctx.themeMode.value,
    )

    watchEffect(() => {
      ctx.adapter.theme.apply(resolvedTheme.value, ctx.tokens)
    })

    const providerProps = computed(() => {
      const mode = resolvedTheme.value
      return ctx.adapter.theme.providerProps?.(mode, ctx.tokens) ?? {}
    })

    /* 卸载时把手里的主题交还回去：优先给仍在挂载的上一个 Provider，
       否则回到 inject 到的外层（插件的全局上下文）。 */
    const reapplyTheme = () => ctx.adapter.theme.apply(resolvedTheme.value, ctx.tokens)
    mountedProviders.push(reapplyTheme)
    onUnmounted(() => {
      const index = mountedProviders.indexOf(reapplyTheme)
      if (index !== -1) mountedProviders.splice(index, 1)
      const previous = mountedProviders[mountedProviders.length - 1]
      if (previous) previous()
      else if (parent) applyContextTheme(parent)
    })

    return () => {
      const Root = ctx.adapter.RootProvider
      return h(
        Root,
        mergeProps(
          {
            ...providerProps.value,
            mode: resolvedTheme.value,
            tokens: ctx.tokens,
            locale: ctx.locale.value,
            size: ctx.size.value,
          },
          attrs,
        ),
        slots,
      )
    }
  },
})
