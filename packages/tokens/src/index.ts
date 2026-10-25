/**
 * 设计令牌：只描述语义，不绑定任何 UI 库。
 * 适配器负责把这里的值映射到 element-plus / vant / naive-ui 的主题变量。
 *
 * 这里的字段名与 css/tokens.css 里的变量名是**一一对应**的：
 * `color.primaryHover` ↔ `--fbk-color-primary-hover`。
 * 转换规则见 toCssVars，改字段名时必须同步改 CSS，否则运行时会静默对不上。
 */

export interface FbkTokens {
  color: {
    primary: string
    primaryHover: string
    primaryActive: string
    /** 主色作为文字/图标时的颜色，对比度要求高于填充态 */
    primaryText: string
    /** 主色的浅底：选中行、柔和标签 */
    primaryBg: string
    primaryBgHover: string
    primaryBorder: string
    /** 压在实色主色底上的文字色 */
    onPrimary: string
    /**
     * 实色主色底的交互态。**方向与 primaryHover / primaryActive 相反**：
     * 后两者比主色浅，用于描边与浅底；实色底上压着 onPrimary 文字时，
     * 变浅会把文字对比度打到 3.19:1（AA 不及格），所以这两个必须变深。
     * 暗色主题下 onPrimary 是深墨色，方向再翻一次（见 dark.css）。
     */
    primaryFillHover: string
    primaryFillActive: string

    /** 状态色-填充态：描边、图标、实色底 */
    success: string
    warning: string
    danger: string
    info: string
    /** 状态色-文字态：浅底标签的文字，比填充态深（暗色主题下则相同） */
    successText: string
    warningText: string
    dangerText: string
    infoText: string
    /** 状态色-浅底：标签背景 */
    successBg: string
    warningBg: string
    dangerBg: string
    infoBg: string

    text: string
    textSecondary: string
    textTertiary: string
    textDisabled: string
    textInverse: string

    bg: string
    bgContainer: string
    bgElevated: string
    /** 沉底区：表头、禁用输入框 */
    bgSunken: string
    /** 弹窗背后的压暗遮罩 */
    overlay: string

    border: string
    borderLight: string
    borderStrong: string

    fill: string
    fillHover: string

    /** 键盘焦点环颜色 */
    focusRing: string
  }
  radius: {
    sm: string
    md: string
    lg: string
    round: string
  }
  font: {
    family: string
    /** 等宽字体：单号、ID、金额 */
    familyMono: string
    size: {
      sm: string
      md: string
      lg: string
      xl: string
    }
    lineHeight: string
    /** 表格/密集表单用 */
    lineHeightTight: string
    weightMedium: string
    weightSemibold: string
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
  }
  shadow: {
    sm: string
    md: string
    lg: string
    focusRing: string
  }
  /** 交互反馈的时长刻度。没有更长的档——超过 300ms 用户会觉得卡。 */
  duration: {
    fast: string
    normal: string
    slow: string
  }
  /** 缓动曲线。standard 适用于绝大多数状态变化。 */
  easing: {
    standard: string
    out: string
    in: string
  }
  /**
   * 只管 FBK 组件内部的层叠。
   * 浮层/弹窗归适配器管——那由底层 UI 库的 z-index 体系决定，两边抢会打架。
   */
  zIndex: {
    sticky: string
    dropdown: string
  }
}

export const defaultTokens: FbkTokens = {
  color: {
    /* 与 tokens.css 的 --fbk-color-primary 系列保持同步。
       这组值会被 toCssVars() 注入成运行时 :root，
       **不同步就会覆盖掉 CSS 文件里的新值**（这个坑踩过）。 */
    primary: '#1f3a8a',
    primaryHover: '#4a5f8f',
    primaryActive: '#16295f',
    primaryText: '#1f3a8a',
    primaryBg: '#f4f6fb',
    primaryBgHover: '#e6ebf5',
    primaryBorder: '#9aabd0',
    onPrimary: '#ffffff',
    primaryFillHover: '#16295f',
    primaryFillActive: '#0f1c3f',

    success: '#18a058',
    warning: '#f0a020',
    danger: '#d03050',
    info: '#2080f0',
    successText: '#11703e',
    warningText: '#9a6614',
    dangerText: '#922238',
    infoText: '#165aa8',
    successBg: '#f1f9f5',
    warningBg: '#fef9f2',
    dangerBg: '#fcf3f5',
    infoBg: '#f2f7fe',

    text: '#1f2329',
    textSecondary: '#646a73',
    textTertiary: '#868b93',
    textDisabled: '#a8abb2',
    textInverse: '#ffffff',

    bg: '#f5f6f7',
    bgContainer: '#ffffff',
    bgElevated: '#ffffff',
    bgSunken: '#f0f1f2',
    overlay: 'rgba(31, 35, 41, 0.45)',

    border: '#dee0e3',
    borderLight: '#e8eaed',
    borderStrong: '#a8abb2',

    fill: '#f0f1f2',
    fillHover: '#e8eaed',

    focusRing: '#1f3a8a',
  },
  radius: {
    sm: '2px',
    md: '6px',
    lg: '10px',
    round: '999px',
  },
  font: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    familyMono:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    size: {
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '20px',
    },
    lineHeight: '1.5',
    lineHeightTight: '1.25',
    weightMedium: '500',
    weightSemibold: '600',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 16px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.14)',
    focusRing: '0 0 0 3px rgba(47, 107, 255, 0.28)',
  },
  duration: {
    fast: '100ms',
    normal: '160ms',
    slow: '240ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  zIndex: {
    sticky: '10',
    dropdown: '100',
  },
}

/**
 * 暗色覆盖。只覆盖语义层——圆角、间距、字号、动效在暗色下不变。
 *
 * 注意状态色的角色会反转：浅色主题里 500 是填充色（≥3:1 即可），
 * 暗色主题里同一个值变成暗底上的文字色。所以下面 -text 与浅色主题是两套值。
 */
export const darkColorOverrides: Partial<FbkTokens['color']> = {
  /* 暗色下墨蓝要提亮，否则在深底上看不清 */
  primary: '#6a7fb0',
  primaryHover: '#9aabd0',
  primaryActive: '#4a5f8f',
  primaryText: '#9aabd0',
  primaryBg: '#1a2340',
  primaryBgHover: '#1f2a4d',
  primaryBorder: '#2d3f6b',
  onPrimary: '#1f2329',
  primaryFillHover: '#7ba3ff',
  primaryFillActive: '#acc4ff',

  success: '#63e2b7',
  warning: '#f2c97d',
  danger: '#e88080',
  info: '#70c0e8',
  successText: '#63e2b7',
  warningText: '#f2c97d',
  dangerText: '#e88080',
  infoText: '#70c0e8',
  successBg: '#14261f',
  warningBg: '#2a2113',
  dangerBg: '#2b191c',
  infoBg: '#131f2b',

  text: '#e5eaf3',
  textSecondary: '#a3a6ad',
  textTertiary: '#868b93',
  textDisabled: '#6b6f76',
  textInverse: '#1f2329',

  bg: '#101014',
  bgContainer: '#18181c',
  bgElevated: '#1f1f24',
  bgSunken: '#131317',
  overlay: 'rgba(0, 0, 0, 0.62)',

  border: '#2d2d33',
  borderLight: '#26262b',
  borderStrong: '#4d525a',

  fill: '#222227',
  fillHover: '#2a2a30',

  focusRing: '#7ba3ff',
}

/**
 * 未来科技风（cyber）覆盖。
 *
 * 与 cyber.css 里的值**必须保持一致** —— 两处重复是刻意的：
 *   · cyber.css 供纯 CSS 消费者（只引样式、不走 JS 主题桥）；
 *   · 这份 TS 对象供适配器把色值注入 UI 库自己的变量
 *     （element-plus 的 --el-color-primary、naive 的 primaryColor）。
 * 只写 CSS 的话，element-plus 的主按钮仍然读它自己的 --el-color-primary，
 * 结果就是「表格是青色主题、按钮还是蓝色」—— 实测过这个割裂。
 *
 * 一致性由 packages/tokens/tests/cyber.spec.ts 断言（逐字段比对 CSS 与 TS）。
 */
export const cyberColorOverrides: Partial<FbkTokens['color']> = {
  primary: '#22d3ee',
  primaryHover: '#67e8f9',
  primaryActive: '#06b6d4',
  primaryText: '#67e8f9',
  primaryBg: '#0a2330',
  primaryBgHover: '#0e2f40',
  primaryBorder: '#155e75',
  onPrimary: '#041016',
  primaryFillHover: '#67e8f9',
  primaryFillActive: '#a5f3fc',

  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  info: '#38bdf8',
  successText: '#34d399',
  warningText: '#fbbf24',
  dangerText: '#f87171',
  infoText: '#38bdf8',
  successBg: '#08231b',
  warningBg: '#241a05',
  dangerBg: '#2a0f12',
  infoBg: '#08202e',

  text: '#e6f7fb',
  textSecondary: '#94b8c4',
  textTertiary: '#6b8b98',
  textDisabled: '#4a6570',
  textInverse: '#041016',

  bg: '#070b14',
  bgContainer: '#0c1420',
  bgElevated: '#111c2b',
  bgSunken: '#050910',
  overlay: 'rgba(2, 6, 12, 0.72)',

  border: '#1b3040',
  borderLight: '#142433',
  borderStrong: '#2a4a5e',

  fill: '#101b28',
  fillHover: '#162435',

  focusRing: '#67e8f9',
}

/** camelCase → kebab-case：primaryHover → primary-hover */
const kebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * 把 token 展平为 CSS 变量表，供 CSS 变量型适配器使用。
 *
 * 键名必须与 css/tokens.css 里的变量名逐字对应，所以这里做 kebab 转换。
 * 这不是可选项：漏了转换，`color.primaryHover` 会输出 `--fbk-color-primaryHover`,
 * 而 CSS 里定义的是 `--fbk-color-primary-hover`，浏览器认不出这个变量，
 * 直接忽略——不报错，只是样式没生效，极难排查。
 */
export function toCssVars(tokens: FbkTokens = defaultTokens): Record<string, string> {
  const vars: Record<string, string> = {}

  const walk = (prefix: string, value: unknown) => {
    if (typeof value === 'string') {
      vars[prefix] = value
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        walk(`${prefix}-${kebab(key)}`, nested)
      }
    }
  }

  walk('--fbk', tokens)
  return vars
}
