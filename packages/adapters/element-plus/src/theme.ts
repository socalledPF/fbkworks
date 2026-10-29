import type { ThemeBridge, ThemeMode } from '@fbkworks/adapter-core'
import { THEME_IS_DARK } from '@fbkworks/adapter-core'
import { cyberColorOverrides, darkColorOverrides } from '@fbkworks/tokens'
import type { FbkTokens } from '@fbkworks/tokens'

/**
 * 按模式取令牌。
 *
 * 这一步是**必须的**：apply() 把变量写成 documentElement 的**行内样式**，
 * 行内优先级高于 element-plus 的 `html.dark` 规则。如果暗色下仍然传浅色令牌，
 * 暗色会被行内变量整片盖掉 —— 实测未选中页码 1.17:1、辅助文字 3.38:1，
 * 也就是说「切了暗色但文字还是深灰压在深底上」。
 *
 * cyber 需要它自己的色值：只引 cyber.css 是不够的 —— element-plus 的
 * 主按钮读的是 `--el-color-primary`，那是 apply() 从这里写进去的。
 * 不注入就会得到「表格是青色、按钮还是蓝色」的割裂观感（实测过）。
 */
function resolveTokens(mode: ThemeMode, tokens: FbkTokens): FbkTokens {
  if (mode === 'cyber') {
    return { ...tokens, color: { ...tokens.color, ...cyberColorOverrides } }
  }
  const dark = mode === 'system' ? false : THEME_IS_DARK[mode]
  if (!dark) return tokens
  return { ...tokens, color: { ...tokens.color, ...darkColorOverrides } }
}

function toElementVars(tokens: FbkTokens): Record<string, string> {
  return {
    '--el-color-primary': tokens.color.primary,
    '--el-color-primary-light-3': tokens.color.primaryHover,
    '--el-color-primary-dark-2': tokens.color.primaryActive,
    '--el-color-success': tokens.color.success,
    '--el-color-warning': tokens.color.warning,
    '--el-color-danger': tokens.color.danger,
    '--el-color-info': tokens.color.info,

    /* element-plus 的浅色面（标签底、斑马纹、hover 填充、禁用态）读的是
       primary-light-5/7/8/9 这一档。只写 light-3 的话这些面仍用 element-plus
       自己的调色板 —— 绿是它那支偏黄的绿，不是 FBK 的绿。
       这就是「状态标签说不上哪里不对」的根因：底色和文字来自两套色系。 */
    '--el-color-primary-light-5': tokens.color.primaryHover,
    '--el-color-primary-light-7': tokens.color.primaryBorder,
    '--el-color-primary-light-8': tokens.color.primaryBg,
    '--el-color-primary-light-9': tokens.color.primaryBg,
    '--el-color-success-light-9': tokens.color.successBg,
    '--el-color-warning-light-9': tokens.color.warningBg,
    '--el-color-danger-light-9': tokens.color.dangerBg,
    '--el-color-info-light-9': tokens.color.infoBg,

    '--el-text-color-primary': tokens.color.text,
    '--el-text-color-regular': tokens.color.textSecondary,
    '--el-text-color-secondary': tokens.color.textSecondary,
    '--el-text-color-placeholder': tokens.color.textDisabled,
    '--el-text-color-disabled': tokens.color.textDisabled,
    '--el-bg-color': tokens.color.bgContainer,
    '--el-bg-color-page': tokens.color.bg,
    '--el-bg-color-overlay': tokens.color.bgElevated,
    '--el-border-color': tokens.color.border,
    '--el-border-color-light': tokens.color.borderLight,
    '--el-border-color-lighter': tokens.color.borderLight,
    '--el-fill-color': tokens.color.fill,
    '--el-fill-color-light': tokens.color.fillHover,
    '--el-fill-color-lighter': tokens.color.fill,
    /* .el-table 在自己身上声明 --el-table-bg-color: var(--el-fill-color-blank)，
       所以这个变量是暗色表格能不能变暗的唯一开关 */
    '--el-fill-color-blank': tokens.color.bgContainer,
    '--el-border-radius-base': tokens.radius.md,
    '--el-border-radius-small': tokens.radius.sm,
    '--el-font-size-base': tokens.font.size.md,
    '--el-font-family': tokens.font.family,

    /* 实色主按钮上的文字色。
       element-plus 默认写死 #fff，但 cyber 的主色是亮青（#22d3ee），
       白字压上去只有 1.81:1 —— 远低于 AA。tokens 早就把 onPrimary 定义成
       「压在实色主色底上的文字色」，这里把它接上，让主题自己决定黑白。
       浅色/暗色主题下 onPrimary 分别是 #fff / #1f2329，行为不变。 */
    '--el-button-text-color': tokens.color.onPrimary,
  }
}

/** element-plus 是 CSS 变量型主题：直接写 :root 变量 + 切换 html.dark。 */
export const elementTheme: ThemeBridge = {
  apply(mode, tokens) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const resolved = resolveTokens(mode, tokens)
    // element-plus 只认 .dark 这个 class，不认自定义主题名。
    // cyber 是暗底，所以也要挂上 .dark，否则它内部的浅色规则会盖住 cyber 配色。
    const dark = mode === 'system' ? false : THEME_IS_DARK[mode]
    root.classList.toggle('dark', dark)
    root.setAttribute('data-fbk-theme', mode)
    for (const [key, value] of Object.entries(toElementVars(resolved))) {
      root.style.setProperty(key, value)
    }
  },
}
