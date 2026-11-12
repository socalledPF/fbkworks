import { inject, type InjectionKey, type Ref } from 'vue'
import type { FbkTokens } from '@fbkworks/tokens'
import type { Size } from './contracts/primitives'
import type { ThemeMode } from './contracts/theme'
import { ADAPTER_API_VERSION, assertAdapterCompatible, type UiAdapter } from './contracts/adapter'
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

/**
 * 取当前 UI 适配器。
 *
 * 顺带做一次**运行时兼容校验**：`components` 与 `adapter-core` 现在是同组发布，
 * 但拆 `fixed` 之后两者可以各自升级 —— 那时「组件 0.5 配 core 0.4」或
 * 「core 0.5 配一个按 0.4 契约写的适配器」都不会在构建期报错，只会在运行时
 * 表现得莫名其妙（少了原语就是 undefined，多了字段就被忽略）。
 *
 * 所以每个用到适配器的组件在第一次渲染时都会经过这里，版本对不上就立刻带着
 * 版本号说清楚 —— 而不是让问题漂到业务方的某个页面上。
 */
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
  /* 三条入口必须给出同一个结论。
     以前这里只查 apiVersion：一个 apiVersion 正确但缺 DataGrid / RootProvider 的适配器，
     assertAdapterCompatible 会拒绝、这里放行、requirePrimitive 也放行 —— 同一个对象三种答案。
     现在首次取用时跑一遍全量校验，通过后记进 WeakSet：后续调用零成本，
     且适配器对象是模块级常量，WeakSet 不会拖住任何东西。 */
  validateOnce(ctx.adapter)
  return ctx.adapter
}

/** 已经通过全量校验的适配器（模块级常量，天然幂等） */
const validatedAdapters = new WeakSet<object>()

function validateOnce(adapter: UiAdapter): void {
  if (validatedAdapters.has(adapter)) return
  /* 先跑版本判定再跑全量校验：两者都会拒绝版本不符的适配器，但前者的文案
     「适配器 apiVersion 是 2，当前要求 3」比后者的一句「不兼容」更好排查。
     顺序固定，不会出现「先报缺原语、修好后又报版本」的来回。 */
  assertAdapterVersion(adapter)
  assertAdapterCompatible(adapter)
  validatedAdapters.add(adapter)
}

/**
 * 版本对不上就在这里炸，带上双方版本号。
 *
 * 只在 `useAdapter()` 里做，而不是每个组件各写一遍 —— 组件拿适配器只有这一个入口，
 * 挡在入口上就不存在「漏了一个组件」。
 */
function assertAdapterVersion(adapter: UiAdapter): void {
  const actual = adapter.meta?.apiVersion
  if (actual !== ADAPTER_API_VERSION) {
    throw new Error(
      `[fbk] 适配器「${adapter.meta?.name ?? 'unknown'}」的 apiVersion 是 ${actual ?? '未声明'}，` +
        `当前 @fbkworks/adapter-core 要求 ${ADAPTER_API_VERSION}。` +
        '这通常意味着 @fbkworks/components 与 @fbkworks/adapter-core 版本不匹配，' +
        '或适配器是按旧契约写的。请把两者升到同一版本线。',
    )
  }
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
