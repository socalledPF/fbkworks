import { computed, defineComponent, type PropType } from 'vue'
import { ConfigProvider } from 'vant'
import type { Size, ThemeMode } from '@fbkworks/adapter-core'
import { defaultTokens } from '@fbkworks/tokens'
import type { FbkTokens } from '@fbkworks/tokens'
import { vantSizeVars, vantTheme } from './theme'

/**
 * vant 4 支持 CSS 变量 + ConfigProvider theme="dark"。
 * tokens 由 theme.apply() 写入 --van-* 变量，这里只声明以消费掉契约入参。
 */
export const RootProvider = defineComponent({
  name: 'FbkVantRootProvider',
  inheritAttrs: false,
  props: {
    mode: { type: String as () => ThemeMode, default: 'light' },
    tokens: { type: Object as PropType<FbkTokens>, default: undefined },
    locale: { type: String, default: 'zh-CN' },
    size: { type: String, default: 'md' },
  },
  setup(props, { attrs, slots }) {
    /* size 只能经 themeVars 注入 —— 它写成 provider 元素上的行内 --van-* 变量，
       再靠自定义属性的继承作用到整棵子树（vant 的 ConfigProvider 没有 size 能力）。
       调用方自己传的 theme-vars 要留下：size 变量盖在它上面，而不是整块替换。 */
    const themeVars = computed<Record<string, string> | undefined>(() => {
      const own = (attrs as Record<string, any>).themeVars ?? (attrs as Record<string, any>)['theme-vars']
      const sizeVars = vantSizeVars(props.size as Size)
      return sizeVars ? { ...own, ...sizeVars } : own
    })

    /* 主题映射交给 theme bridge，别再在这里手写一遍：
       这里原来写的是 `mode === 'dark' ? 'dark' : 'light'`，于是 **cyber 被映射成 light**，
       而 bridge 里那段「cyber 是暗底，按暗色处理」的 providerProps 从没被消费
       （RootProvider 的 props 里没有 theme，传下来落进 attrs 又被这行覆盖）。 */
    const configTheme = computed<'light' | 'dark'>(() => {
      /* providerProps 的签名要求带 tokens；vant 的映射只看 mode，
         但按签名传（缺省时用默认令牌）比在这里再猜一次 mode 更不容易漂。 */
      const resolved = vantTheme.providerProps?.(props.mode, props.tokens ?? defaultTokens)
      return (resolved?.theme as 'light' | 'dark' | undefined) ?? 'light'
    })

    return () => (
      /* ConfigProvider 自己渲染一层元素（tag 默认 'div'，class="van-config-provider"），
         attrs 交给它就能落到真实 DOM，不必再套一层。
         attrs 在前：显式的 theme / provider props 优先。 */
      <ConfigProvider
        {...attrs}
        theme={configTheme.value}
        themeVars={themeVars.value}
      >
        {slots.default?.()}
      </ConfigProvider>
    )
  },
})
