import { defineComponent, type PropType } from 'vue'
import { ConfigProvider } from 'vant'
import type { ThemeMode } from '@fbk/adapter-core'
import type { FbkTokens } from '@fbk/tokens'

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
    return () => (
      /* ConfigProvider 自己渲染一层元素（tag 默认 'div'，class="van-config-provider"），
         attrs 交给它就能落到真实 DOM，不必再套一层。
         attrs 在前：显式的 theme / provider props 优先。 */
      <ConfigProvider {...attrs} theme={props.mode === 'dark' ? 'dark' : 'light'}>
        {slots.default?.()}
      </ConfigProvider>
    )
  },
})
