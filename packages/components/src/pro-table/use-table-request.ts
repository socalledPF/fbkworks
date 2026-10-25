import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { toErrorEvent, useReporter, type SortState } from '@fbk/adapter-core'
import type { TableRequest, TableRequestParams, TableResponse } from './types'

export interface UseTableRequestOptions<T> {
  request: () => TableRequest<T> | undefined
  params: () => Record<string, any>
  page: Ref<number>
  pageSize: Ref<number>
  sort: () => SortState | null
  /** 移动端无限滚动：追加而不是替换 */
  append?: () => boolean
  onLoad?: (result: TableResponse<T>, requestParams: TableRequestParams) => void
  onError?: (error: unknown, requestParams: TableRequestParams) => void
}

export function useTableRequest<T>(options: UseTableRequestOptions<T>) {
  const data = shallowRef<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  const finished = ref(false)

  /* 统一上报出口。未配置 onTelemetry / onError 时是 noop，零开销。
     这是组件库里最有价值的上报点：表格请求是失败率最高、
     也最能反映后端问题的地方。 */
  const reporter = useReporter()

  let requestId = 0
  let controller: AbortController | null = null

  async function load(append = false) {
    const request = options.request()
    if (!request) return

    const id = ++requestId
    controller?.abort()
    controller = new AbortController()

    const requestParams: TableRequestParams = {
      page: options.page.value,
      pageSize: options.pageSize.value,
      sort: options.sort(),
      params: options.params(),
      signal: controller.signal,
    }

    loading.value = true
    error.value = null

    const startedAt = reporter.enabled ? performance.now() : 0

    try {
      const result = await request(requestParams)
      // 过期响应直接丢弃，防止快速翻页时旧数据覆盖新数据
      if (id !== requestId) return

      if (append) {
        data.value = [...data.value, ...result.list]
        finished.value = result.hasMore === false
      } else {
        data.value = result.list
        finished.value = result.hasMore === false
      }
      total.value = result.total ?? data.value.length
      options.onLoad?.(result, requestParams)

      if (reporter.enabled) {
        reporter.telemetry({
          type: 'request',
          name: 'ProTable.request',
          duration: Math.round(performance.now() - startedAt),
          success: true,
          context: { page: requestParams.page, pageSize: requestParams.pageSize, rows: result.list.length },
        })
      }
    } catch (err) {
      // 取消不是错误：快速翻页时旧请求被 abort 属于正常流程
      if (id !== requestId || controller.signal.aborted) return
      error.value = err
      options.onError?.(err, requestParams)

      if (reporter.enabled) {
        reporter.error(
          toErrorEvent(err, 'request', 'FbkProTable', {
            page: requestParams.page,
            pageSize: requestParams.pageSize,
            params: requestParams.params,
            sort: requestParams.sort,
          }),
        )
        reporter.telemetry({
          type: 'request',
          name: 'ProTable.request',
          duration: Math.round(performance.now() - startedAt),
          success: false,
        })
      }
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function reload(options_: { resetPage?: boolean } = {}) {
    if (options_.resetPage) options.page.value = 1
    data.value = []
    finished.value = false
    return load(false)
  }

  function loadMore() {
    if (loading.value || finished.value) return
    options.page.value += 1
    return load(true)
  }

  watch(
    () => [options.page.value, options.pageSize.value, options.sort(), options.params()],
    () => {
      if (!options.request()) return
      load(false)
    },
    { deep: true, immediate: true },
  )

  onBeforeUnmount(() => {
    controller?.abort()
    requestId++
  })

  return { data, total, loading, error, finished, load, reload, loadMore }
}
