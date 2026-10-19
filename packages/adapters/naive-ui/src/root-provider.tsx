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
import type { ThemeMode } from '@fbk/adapter-core'
import type { FbkTokens } from '@fbk/tokens'
import { naiveProviderProps } from './theme'
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
  setup(props, { slots }) {
    const config = computed(() => {
      const resolved = props.mode === 'dark' ? 'dark' : 'light'
      if (props.tokens) return naiveProviderProps(resolved, props.tokens)
      return {
        theme: resolved === 'dark' ? darkTheme : null,
        themeOverrides: props.themeOverrides,
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
      <NConfigProvider
        theme={config.value.theme === 'dark' ? darkTheme : null}
        themeOverrides={config.value.themeOverrides}
        locale={localePack.value.locale}
        dateLocale={localePack.value.dateLocale}
      >
        <NMessageProvider>
          <NDialogProvider>{slots.default?.()}</NDialogProvider>
        </NMessageProvider>
      </NConfigProvider>
    )
  },
})
