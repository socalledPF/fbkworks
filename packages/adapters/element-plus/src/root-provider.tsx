import { defineComponent, type PropType } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import type { ThemeMode } from '@fbk/adapter-core'
import type { FbkTokens } from '@fbk/tokens'

const locales: Record<string, any> = { 'zh-CN': zhCn, en }

/**
 * element-plus 的主题走 CSS 变量，Provider 只负责 locale / size。
 *
 * mode 与 tokens 在契约里是所有 RootProvider 共有的入参，这里声明但不使用——
 * 不声明的话它们会作为 extraneous attrs 落到 ElConfigProvider 的 fragment 根节点上，
 * Vue 会报 "could not be automatically inherited"。
 */
export const RootProvider = defineComponent({
  name: 'FbkElRootProvider',
  inheritAttrs: false,
  props: {
    mode: { type: String as () => ThemeMode, default: 'light' },
    tokens: { type: Object as PropType<FbkTokens>, default: undefined },
    locale: { type: String, default: 'zh-CN' },
    size: { type: String, default: 'md' },
  },
  setup(props, { slots }) {
    return () => (
      <ElConfigProvider
        locale={locales[props.locale] ?? zhCn}
        size={props.size === 'md' ? 'default' : props.size === 'sm' ? 'small' : 'large'}
      >
        {slots.default?.()}
      </ElConfigProvider>
    )
  },
})
