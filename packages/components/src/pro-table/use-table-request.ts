import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { toErrorEvent, useReporter, type SortState } from '@fbkworks/adapter-core'
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
  /**
   * 页码被**这里**改动时通知外部（loadMore 触底、重置回第一页）。
   *
   * 需要它的原因：`page` 是受控 prop（`v-model:page`），
   * 而内部改动如果不 emit，父级的 URL 同步/页码显示就会和真实请求页不一致。
   */
  onPageChange?: (page: number) => void
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
      /* 终止条件有两条：
         ① 后端显式说 hasMore === false；
         ② 这一页返回 0 行 —— 这才是 hasMore 缺省时唯一的可靠信号。
         只认 ① 的话，业务方按最常见的 { list, total } 返回（不写 hasMore）时，
         触底会一页页往后请求、每页追加 0 行、底部一直转圈，永远不会停。
         "最后一页刚好满行" 会多发一次请求、拿到空页后停止，这个代价可以接受。 */
      finished.value = result.hasMore === false || result.list.length === 0
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

  /** 改页码的唯一入口：改了就要让外部知道，否则受控的 page 会失步 */
  function setPage(next: number) {
    if (options.page.value === next) return
    options.page.value = next
    options.onPageChange?.(next)
  }

  function reload(options_: { resetPage?: boolean } = {}) {
    /* data 一定会被清空，所以 append 模式下载码必须一起回到 1。
       否则「触底请求失败 → 切到错误态 → 点重试」会请求第 N 页而 data 是空的：
       列表从第 N 页开头，前 N-1 页的数据永久丢失。
       分页模式下仍允许 reload({ resetPage: false }) 刷新当前页。 */
    if (options_.resetPage || isAppend()) setPage(1)
    data.value = []
    finished.value = false
    return load()
  }

  function loadMore() {
    if (loading.value || finished.value) return
    setPage(options.page.value + 1)
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
      if (prev !== undefined && next[0] === prev[0]) setPage(1)
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
