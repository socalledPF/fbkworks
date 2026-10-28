import type { Size, ThemeBridge, ThemeMode } from '@fbk/adapter-core'
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

/**
 * provider size 的比例尺。三个适配器共用同一套相对关系：
 * md 是基准，sm 是它的 0.75 倍，lg 是 1.25 倍 ——
 * element-plus 的 small/default/large 正好是 24/32/40px。
 */
const SIZE_SCALE: Record<Size, number> = { sm: 0.75, md: 1, lg: 1.25 }

/**
 * 缩放对象。vant 4.10 的 ConfigProvider **没有 size 能力**（props 只有 tag /
 * theme / zIndex / themeVars / themeVarsDark / themeVarsLight / themeVarsScope /
 * iconPrefix），控件几何全部由 --van-* 变量顶着，themeVars 是唯一的注入口。
 * 基准值取自 vant 自己的 lib/index.css；只缩控件几何，不缩字号与行高 ——
 * 字号归 tokens.font.size 管，跟着缩会把可读性拖下水。
 */
const CONTROL_HEIGHTS = {
  buttonDefaultHeight: 44,
  buttonSmallHeight: 32,
  buttonMiniHeight: 24,
  buttonLargeHeight: 50,
  cellVerticalPadding: 10,
} as const

const toPx = (value: number) => `${Number.isInteger(value) ? value : Number(value.toFixed(2))}px`

/**
 * md 返回 undefined：vant 的默认值就是 md 这一档，注入一份等值变量等于把
 * 库的默认值钉死在这份快照上，vant 将来调默认值时这里会静默错位。
 */
export function vantSizeVars(size: Size = 'md'): Record<string, string> | undefined {
  const scale = SIZE_SCALE[size] ?? 1
  if (scale === 1) return undefined
  const vars: Record<string, string> = {}
  for (const [name, base] of Object.entries(CONTROL_HEIGHTS)) vars[name] = toPx(base * scale)
  return vars
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
