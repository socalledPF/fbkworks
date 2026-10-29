import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * 窄屏判定。
 *
 * 断点写在这里的唯一原因是「抽屉得知道往哪边滑」——
 * 而 CSS 侧的窄屏折叠是容器查询（见 page-container/style.css 的说明）。
 * 取值必须与仓库 CSS 对齐：`@media (max-width: 639px)`，
 * 用 639 而不是 640 —— ≥640 才算桌面。
 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 639px)'

export interface UseMobileViewportReturn {
  isMobile: Ref<boolean>
}

export function useMobileViewport(query: string = MOBILE_VIEWPORT_QUERY): UseMobileViewportReturn {
  const isMobile = ref(false)

  /* 没有 matchMedia 的环境（SSR、极老的 WebView）退化为桌面：
     抽屉依然可用，只是不会切成底部全屏，而不是整块渲染不出来。 */
  if (typeof window === 'undefined' || !window.matchMedia) return { isMobile }

  const mql = window.matchMedia(query)
  isMobile.value = mql.matches

  const onChange = (event: { matches: boolean }) => {
    isMobile.value = event.matches
  }

  mql.addEventListener?.('change', onChange)
  onBeforeUnmount(() => mql.removeEventListener?.('change', onChange))

  return { isMobile }
}
