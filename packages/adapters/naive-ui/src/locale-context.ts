import type { ComputedRef, InjectionKey } from 'vue'

/**
 * naive 的 NPagination 跳页组只渲染「跳至 [输入框]」，
 * 而 element-plus 是「前往 [输入框] 页」—— 少一个尾部单位字。
 *
 * 这个字属于 locale（zh 是「页」、en 是「page」），不能写死在 CSS 里，
 * 所以由 RootProvider 把当前语言包的 Pagination.selectionSuffix 传下来。
 */
export const PAGINATION_SUFFIX: InjectionKey<ComputedRef<string>> = Symbol.for(
  'fbk.naive.pagination-suffix',
)
