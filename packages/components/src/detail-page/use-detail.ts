import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { toErrorEvent, useReporter } from '@fbkworks/adapter-core'

/**
 * 详情数据获取。
 *
 * 与 `useTableRequest` 的区别：
 *   · 不带分页/排序参数 —— 详情就是取一条
 *   · `null` 有明确语义（资源不存在 → 404），不是「空列表」
 *   · 只有「成功/失败」两态，没有 hasMore / finished
 *
 * 与 `useTableRequest` 的共同点（这就是约定的价值）：
 *   · 内置 AbortController，丢弃过期响应
 *   · 失败走统一的 useReporter()，不要求业务方手接
 */

export interface UseDetailOptions<T> {
  /** 取详情。返回 null 表示资源不存在 */
  fetcher: () => Promise<T | null>
  /** 是否挂载即请求，默认 true */
  immediate?: boolean
  /** 额外的错误回调（在统一上报之后调用） */
  onError?: (error: unknown) => void
}

export interface UseDetailReturn<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<unknown>
  /** 重新请求 */
  reload: () => Promise<void>
}

export function useDetail<T>(options: UseDetailOptions<T>): UseDetailReturn<T> {
  const data = shallowRef<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = shallowRef<unknown>(null)

  const reporter = useReporter()

  let requestId = 0
  let controller: AbortController | null = null

  async function load() {
    const id = ++requestId

    /* 取消上一次请求。
       详情页的典型竞态：快速切换 id（列表里连点几条）。
       不取消的话，慢的那条后返回会覆盖快的 —— 用户看到 A 的数据
       但标题是 B。 */
    controller?.abort()
    controller = new AbortController()

    const startedAt = reporter.enabled ? performance.now() : 0
    loading.value = true
    error.value = null

    try {
      const result = await options.fetcher()

      // 过期响应直接丢弃
      if (id !== requestId) return

      data.value = result

      if (reporter.enabled) {
        reporter.telemetry({
          type: 'request',
          name: 'DetailPage.request',
          duration: Math.round(performance.now() - startedAt),
          // 注意：null 不是错误，是「资源不存在」
          success: result !== null,
        })
      }
    } catch (err) {
      // 取消不是错误
      if (id !== requestId || controller.signal.aborted) return

      error.value = err
      options.onError?.(err)

      reporter.error(toErrorEvent(err, 'component', 'FbkDetailPage'))
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  if (options.immediate !== false) {
    onMounted(load)
  }

  onBeforeUnmount(() => {
    controller?.abort()
    requestId++
  })

  return { data, loading, error, reload: load }
}

/**
 * 挂载后监听 fetcher 变化并重新请求的变体。
 *
 * 为什么单独导出而不放在 useDetail 里：`watch` 一个函数引用
 * 只在引用变化时触发，而多数业务的 fetcher 是箭头函数
 * （每次渲染都是新引用）—— 内置会让行为变得不可预测。
 * 需要「id 变了自动重新请求」时，显式用这个。
 */
export function useDetailWatch<T>(
  options: UseDetailOptions<T> & { watchSource: () => unknown },
): UseDetailReturn<T> {
  const state = useDetail(options)
  watch(options.watchSource, () => state.reload())
  return state
}
