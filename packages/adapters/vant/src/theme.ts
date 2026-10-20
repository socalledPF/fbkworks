import type { ThemeBridge, ThemeMode } from '@fbk/adapter-core'
import { THEME_IS_DARK } from '@fbk/adapter-core'
import type { FbkTokens } from '@fbk/tokens'

function toVantVars(tokens: FbkTokens): Record<string, string> {
  return {
    '--van-primary-color': tokens.color.primary,
    '--van-success-color': tokens.color.success,
    '--van-danger-color': tokens.color.danger,
    '--van-warning-color': tokens.color.warning,
    '--van-text-color': tokens.color.text,
    '--van-text-color-2': tokens.color.textSecondary,
    '--van-text-color-3': tokens.color.textDisabled,
    '--van-background': tokens.color.bg,
    '--van-background-2': tokens.color.bgContainer,
    '--van-border-color': tokens.color.border,
    '--van-radius-md': tokens.radius.md,
    '--van-radius-lg': tokens.radius.lg,
    '--van-font-size-md': tokens.font.size.md,
    '--van-base-font': tokens.font.family,
  }
}

export const vantTheme: ThemeBridge = {
  apply(mode, tokens) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-fbk-theme', mode)
    // vant 的暗色同时依赖 ConfigProvider，这里负责 fbk 自身的变量与文档根标记
    for (const [key, value] of Object.entries(toVantVars(tokens))) {
      root.style.setProperty(key, value)
    }
  },
  providerProps(mode) {
    // cyber 是暗底主题，vant 只认 light / dark，按暗色处理
    const dark = mode === 'system' ? false : THEME_IS_DARK[mode as Exclude<ThemeMode, 'system'>]
    return { theme: dark ? 'dark' : 'light' }
  },
}
