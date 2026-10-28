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
  /** 最近一次请求用的页码：watch 靠它认出「这次改页码是 loadMore/reload 自己干的」 */
  let issuedPage: number | null = null

  /** 追加还是替换由 options.append 决定，不再靠调用方传参 */
  function isAppend() {
    return options.append?.() ?? false
  }

  async function load(append = isAppend()) {
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
    issuedPage = requestParams.page

    loading.value = true
    error.value = null

    const startedAt = reporter.enabled ? performance.now() : 0

    try {
      const result = await request(requestParams)
      // 过期响应直接丢弃，防止快速翻页时旧数据覆盖新数据
      if (id !== requestId) return

      data.value = append ? [...data.value, ...result.list] : result.list
      finished.value = result.hasMore === false
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
    return load()
  }

  function loadMore() {
    if (loading.value || finished.value) return
    options.page.value += 1
    return load()
  }

  /* 用户翻页、改排序、改筛选都是「重新查」：替换而不是接着往后拼。
     无限滚动下旧行已经过期，先清掉，否则新一页会拼在旧数据后面。 */
  function refresh() {
    if (isAppend()) data.value = []
    return load()
  }

  watch(
    () => [options.page.value, options.pageSize.value, options.sort(), options.params()] as const,
    (next, prev) => {
      if (!options.request()) return
      /* 这一次变化是不是我们自己改页码造成的？loadMore、reload({ resetPage })
         以及下面那次「筛选变化回第一页」都算：它们改完页码就自己发过请求了，
         这里再发一次就是「一次触底两个 page=2 请求」。 */
      const selfPageChange =
        prev !== undefined &&
        next[1] === prev[1] &&
        next[2] === prev[2] &&
        next[3] === prev[3] &&
        next[0] !== prev[0] &&
        next[0] === issuedPage
      if (selfPageChange) return

      /* 筛选条件（params / sort / pageSize）变了就回到第一页：
         停在第 3 页查一个只有 1 页结果的关键词会拿到空列表，用户看到「暂无数据」。
         翻页本身不改页码 —— 用户点第几页就查第几页。 */
      if (prev !== undefined && next[0] === prev[0]) options.page.value = 1
      refresh()
    },
    { deep: true, immediate: true },
  )

  onBeforeUnmount(() => {
    controller?.abort()
    requestId++
  })

  return { data, total, loading, error, finished, load, reload, loadMore }
}
