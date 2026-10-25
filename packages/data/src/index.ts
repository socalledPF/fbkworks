/**
 * 数据层契约。与后端规范、UI 库都无关。
 */
export { createPageRequest } from './create'
export { FbkDataError, previewRaw } from './error'
export { extractRows, extractTotal, getByPath } from './path'
export { assertServerScope } from './scope'

export type {
  CreatePageRequestConfig,
  DataScope,
  Page,
  PageFetcher,
  PageQuery,
  PageSort,
  PathSpec,
} from './types'
