import type { ThemeBridge, ThemeMode } from '@fbk/adapter-core'
import { THEME_IS_DARK } from '@fbk/adapter-core'
import { cyberColorOverrides, darkColorOverrides } from '@fbk/tokens'
import type { FbkTokens } from '@fbk/tokens'

/**
 * 按模式取令牌。naive 的暗色走 theme="dark"，但 themeOverrides 里的颜色
 * 必须也跟着换 —— 否则 override 会把 naive 自己的暗色值盖回浅色。
 *
 * cyber 归到 dark 处理：naive 只认识 light / dark 两个 theme，
 * 它没有「风格」这个概念。cyber 的青色主色通过 themeOverrides 里的
 * primaryColor 系列注入，底色则继续由 cyber.css 的 CSS 变量承担
 * （naive 的 DataTable/Tag 走 themeOverrides，其余 fbk-* 元素走 CSS 变量）。
 */
function isDark(mode: ThemeMode): boolean {
  return mode === 'system' ? false : THEME_IS_DARK[mode]
}

function resolveTokens(mode: ThemeMode, tokens: FbkTokens): FbkTokens {
  // cyber 有自己的青色色板；不注入的话 naive 的按钮/表格仍是默认蓝
  if (mode === 'cyber') {
    return { ...tokens, color: { ...tokens.color, ...cyberColorOverrides } }
  }
  if (!isDark(mode)) return tokens
  return { ...tokens, color: { ...tokens.color, ...darkColorOverrides } }
}

/**
 * naive-ui 没有 CSS 变量，主题必须通过 NConfigProvider 的 theme + themeOverrides。
 * 因此 providerProps 是必需的；只调用 apply() 不会让暗色生效。
 */
export function naiveProviderProps(mode: ThemeMode, tokens: FbkTokens) {
  const t = resolveTokens(mode, tokens)

  return {
    theme: isDark(mode) ? 'dark' : 'light',
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
        fontFamily: t.font.family,
        /* 注意：这里**不设** fontSize。
           naive 的 NConfigProvider 会把 common.fontSize 写成根节点的
           font-size，而 element-plus 不注入字号。设了它，同一个组件在
           两个适配器下就会继承到不同的基准字号（14 vs 16），
           行高、内边距全线错位。字号由组件样式自己声明（见各 style.css）。 */

        /**
         * 控件高度对齐 element-plus。
         *
         * naive 默认 heightMedium = 34px，element-plus 默认尺寸是 32px。
         * 同一个 QueryForm 在两个适配器下输入框差 2px，整行跟着错位。
         */
        heightSmall: '28px',
        heightMedium: '32px',
        heightLarge: '40px',
      },

      /**
       * 按钮。element-plus 默认是 height 32 / padding 0 15px / font-weight 500，
       * naive 是 height 34 / padding 0 14px / 400。三项都在 themeOverrides
       * 里对齐，不靠 CSS —— naive 的按钮样式是运行时生成的，
       * CSS 要 !important 才能赢，而那会让消费方无法再覆盖。
       */
      Button: {
        fontWeight: t.font.weightMedium,
        fontWeightStrong: t.font.weightSemibold,
        paddingMedium: '0 15px',
        paddingSmall: '0 11px',
        paddingLarge: '0 19px',
      },

      /**
       * 表单标签色。element-plus 用 --el-text-color-regular（次级文字色），
       * naive 默认 textColor1（正文色）。对齐到次级色，标签与值才有层级差。
       */
      Form: {
        labelTextColor: t.color.textSecondary,
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
  providerProps: (mode, tokens) => naiveProviderProps(mode, tokens),
}
