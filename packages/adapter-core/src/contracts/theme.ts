import type { FbkTokens } from '@fbk/tokens'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeBridge {
  /**
   * CSS 变量型库：直接写 :root 变量或切换根 class。
   * provider 型库：可以只负责切换 `data-fbk-theme`，具体主题由 providerProps 提供。
   */
  apply: (mode: ThemeMode, tokens: FbkTokens) => void
  /** Provider 型库（如 naive-ui）返回给 RootProvider 的 props */
  providerProps?: (mode: ThemeMode, tokens: FbkTokens) => Record<string, unknown>
}
