import { computed, defineComponent, provide, type PropType } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  darkTheme,
  zhCN,
  dateZhCN,
  enUS,
  dateEnUS,
} from 'naive-ui'
import type { Size, ThemeMode } from '@fbk/adapter-core'
import type { FbkTokens } from '@fbk/tokens'
import { naiveProviderProps, naiveSizeHeights } from './theme'
import { installFeedback } from './feedback'
import { PAGINATION_SUFFIX } from './locale-context'

const locales: Record<string, { locale: any; dateLocale: any }> = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  en: { locale: enUS, dateLocale: dateEnUS },
}

/**
 * naive-ui 的主题是 provider 型：暗色必须通过 NConfigProvider 传入 darkTheme。
 * 文档需要明确：只调用 apply() 不会生效，必须用 <FbkProvider> 包裹。
 */
export const RootProvider = defineComponent({
  name: 'FbkNaiveRootProvider',
  inheritAttrs: false,
  props: {
    mode: { type: String as () => ThemeMode, default: 'light' },
    tokens: { type: Object as PropType<FbkTokens>, default: undefined },
    locale: { type: String, default: 'zh-CN' },
    size: { type: String, default: 'md' },
    /** 已由 core 计算好的 provider props；优先使用 */
    themeOverrides: { type: Object as PropType<Record<string, any>>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const config = computed(() => {
      // 不要把 mode 提前降级成 dark/light —— cyber 需要它自己的色板，
      // 只有 naiveProviderProps 内部知道 cyber 该用哪套 themeOverrides。
      // 早期这里写了 `props.mode === 'dark' ? 'dark' : 'light'`，
      // 结果 cyber 被当成 light，主按钮保持默认蓝（实测 rgb(47,107,255)）。
      if (props.tokens) {
        const { theme, themeOverrides } = naiveProviderProps(
          props.mode,
          props.tokens,
          props.size as Size,
        )
        // naiveProviderProps 返回的是 'dark' | 'light' 字符串，这里换成真正的 theme 对象
        return { theme: theme === 'dark' ? darkTheme : null, themeOverrides }
      }
      /* 没有 tokens 时高度用的是 naive 自己的默认值，md 正是那一档 —— 注入会改默认视觉，
         所以只有显式要求 sm / lg 时才补。调用方自带的 themeOverrides 原样保留。 */
      const sizeHeights = props.size === 'md' ? undefined : naiveSizeHeights(props.size as Size)
      return {
        theme: props.mode === 'light' ? null : darkTheme,
        themeOverrides: sizeHeights
          ? {
              ...props.themeOverrides,
              common: { ...props.themeOverrides?.common, ...sizeHeights },
            }
          : props.themeOverrides,
      }
    })

    const localePack = computed(() => locales[props.locale] ?? locales['zh-CN'])

    /* 跳页组的尾部单位字。element-plus 的跳页是「前往 [1] 页」，
       naive 只有「跳至 [1]」。这个字属于语言包，不能写死在 CSS 里。 */
    provide(
      PAGINATION_SUFFIX,
      computed(() => (localePack.value.locale.Pagination as any)?.selectionSuffix ?? ''),
    )

    return () => (
      /* NConfigProvider 自己渲染一层元素（tag 默认 'div'，class="n-config-provider"），
         attrs 交给它落到那层元素上；attrs 在前，显式配置优先。 */
      <NConfigProvider
        {...attrs}
        theme={config.value.theme ?? null}
        themeOverrides={config.value.themeOverrides}
        locale={localePack.value.locale}
        dateLocale={localePack.value.dateLocale}
      >
        <NMessageProvider>
          <NDialogProvider>
            <FeedbackInstaller>{slots.default?.()}</FeedbackInstaller>
          </NDialogProvider>
        </NMessageProvider>
      </NConfigProvider>
    )
  },
})

/**
 * 在 NMessageProvider / NDialogProvider **内部**调用 installFeedback。
 *
 * 为什么需要这个内部组件：useMessage / useDialog 依赖 inject，
 * 必须在 provider 的后代里调用。放在 RootProvider 自己的 setup 里
 * 拿到的是空实例，运行时报「No outer <n-message-provider /> founded」。
 */
const FeedbackInstaller = defineComponent({
  name: 'FbkNaiveFeedbackInstaller',
  setup(_props, { slots }) {
    installFeedback()
    return () => slots.default?.()
  },
})
