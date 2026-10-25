/**
 * 数据层契约。与后端规范、UI 库都无关。
 */
export { createPageRequest } from './create'
export { defineBackend } from './backend'
export { FbkDataError, previewRaw } from './error'
export { extractRows, extractTotal, getByPath } from './path'
export { assertServerScope } from './scope'

export type {
  Backend,
  BackendConfig,
  CreatePageRequestConfig,
  DataScope,
  Page,
  PageFetcher,
  PageQuery,
  PageSort,
  PathSpec,
} from './types'
