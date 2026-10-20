import type { FbkTokens } from '@fbk/tokens'

/**
 * 主题模式。
 *
 * `light` / `dark` / `system` 是明暗档位；`cyber` 是**风格预设**，
 * 它是暗底 + 青色主色的未来科技风，不属于明暗轴的第三个值。
 *
 * 为什么混在同一个联合类型里而不是拆成 `mode` + `skin` 两个维度：
 * 拆开会让适配器的 ThemeBridge 签名变成三参数，且 provider 型库
 * （naive-ui）无法表达「风格」这个概念 —— 它只有 light/dark 两个 theme。
 * 混在一起后，适配器只需在 `resolveTheme()` 里把 cyber 归到 dark 的
 * provider props，风格差异全部由 CSS 变量承担。这是当前架构下
 * 唯一不需要改契约版本的方案。
 */
export type ThemeMode = 'light' | 'dark' | 'cyber' | 'system'

/** cyber 是暗底主题，provider 型适配器需要按 dark 处理 */
export const THEME_IS_DARK: Record<Exclude<ThemeMode, 'system'>, boolean> = {
  light: false,
  dark: true,
  cyber: true,
}

export interface ThemeBridge {
  /**
   * CSS 变量型库：直接写 :root 变量或切换根 class。
   * provider 型库：可以只负责切换 `data-fbk-theme`，具体主题由 providerProps 提供。
   */
  apply: (mode: ThemeMode, tokens: FbkTokens) => void
  /** Provider 型库（如 naive-ui）返回给 RootProvider 的 props */
  providerProps?: (mode: ThemeMode, tokens: FbkTokens) => Record<string, unknown>
}
