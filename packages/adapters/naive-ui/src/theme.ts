import type { ThemeBridge } from '@fbk/adapter-core'
import { darkColorOverrides } from '@fbk/tokens'
import type { FbkTokens } from '@fbk/tokens'

/**
 * 按模式取令牌。naive 的暗色走 theme="dark"，但 themeOverrides 里的颜色
 * 必须也跟着换 —— 否则 override 会把 naive 自己的暗色值盖回浅色。
 */
function resolveTokens(mode: 'light' | 'dark', tokens: FbkTokens): FbkTokens {
  if (mode !== 'dark') return tokens
  return { ...tokens, color: { ...tokens.color, ...darkColorOverrides } }
}

/**
 * naive-ui 没有 CSS 变量，主题必须通过 NConfigProvider 的 theme + themeOverrides。
 * 因此 providerProps 是必需的；只调用 apply() 不会让暗色生效。
 */
export function naiveProviderProps(mode: 'light' | 'dark', tokens: FbkTokens) {
  const t = resolveTokens(mode, tokens)

  return {
    theme: mode === 'dark' ? 'dark' : 'light',
    themeOverrides: {
      common: {
        primaryColor: t.color.primary,
        primaryColorHover: t.color.primaryHover,
        primaryColorPressed: t.color.primaryActive,
        successColor: t.color.success,
        warningColor: t.color.warning,
        errorColor: t.color.danger,
        infoColor: t.color.info,
        textColorBase: t.color.text,
        textColor2: t.color.textSecondary,
        textColor3: t.color.textDisabled,
        bodyColor: t.color.bg,
        cardColor: t.color.bgContainer,
        borderColor: t.color.border,
        borderRadius: t.radius.md,
        fontSize: t.font.size.md,
        fontFamily: t.font.family,
      },

      /**
       * Tag 的状态配色必须在这里改，**不能靠 CSS**。
       *
       * naive 的 NTag 不输出状态 class —— 所有状态的 class 都只是 `n-tag`，
       * 颜色完全靠行内的 --n-text-color / --n-color 区分。所以
       * `.n-tag--warning { ... }` 命中不了任何元素，写了也只是看着像修好了。
       *
       * naive 默认是「状态色 + 12~15% 透明」：warning 实测
       * #f0a020 on rgba(240,160,32,.15) = 1.93:1，连大字号标准 3.0 都不到。
       * 根因是它把**填充色**当文字色用，而 tokens 早就把三者分开了。
       */
      Tag: {
        textColorSuccess: t.color.successText,
        colorSuccess: t.color.successBg,
        borderSuccess: '1px solid transparent',

        textColorWarning: t.color.warningText,
        colorWarning: t.color.warningBg,
        borderWarning: '1px solid transparent',

        textColorError: t.color.dangerText,
        colorError: t.color.dangerBg,
        borderError: '1px solid transparent',

        textColorInfo: t.color.infoText,
        colorInfo: t.color.infoBg,
        borderInfo: '1px solid transparent',
      },

      /**
       * DataTable 走 themeOverrides 而不是 CSS：naive 的单元格颜色是
       * 运行时生成的 --n-* 变量，themeOverrides 是唯一不会在小版本升级
       * 时被内部类名变化打碎的入口。
       */
      DataTable: {
        thColor: t.color.bgSunken,
        thTextColor: t.color.text,
        tdColor: t.color.bgContainer,
        tdTextColor: t.color.text,
        borderColor: t.color.borderLight,
        tdColorHover: t.color.primaryBg,
        borderRadius: t.radius.lg,
      },
    },
  }
}

export const naiveTheme: ThemeBridge = {
  apply(mode) {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-fbk-theme', mode)
  },
  providerProps: (mode, tokens) => naiveProviderProps(mode === 'dark' ? 'dark' : 'light', tokens),
}
