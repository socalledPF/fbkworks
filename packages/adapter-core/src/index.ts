/* 从 contracts/adapter 再导出，不要在这里重复定义常量。
   此前这里写死了 `= 1`，而 contracts/adapter.ts 里是另一份 ——
   提升契约版本时只改一处，导出的那个仍然是旧值，
   于是所有适配器在运行时被误判为不兼容。 */
export { ADAPTER_API_VERSION } from './contracts/adapter'

export type {
  AdapterMeta,
  Capabilities,
  UiAdapter,
  UiPrimitives,
} from './contracts/adapter'
export { assertAdapterCompatible, requirePrimitive } from './contracts/adapter'

export type {
  ButtonProps,
  ButtonVariant,
  CheckboxEmits,
  CheckboxProps,
  DatePickerProps,
  DatePickerType,
  RadioOption,
  RadioProps,
  DialogProps,
  DrawerProps,
  FormExpose,
  FormItemProps,
  FormProps,
  InputProps,
  PaginationProps,
  SelectOption,
  SelectProps,
  Size,
  SpinProps,
  Status,
  TagProps,
} from './contracts/primitives'

export type {
  CellRenderContext,
  DataGridColumn,
  DataGridEmits,
  DataGridPresentation,
  DataGridProps,
  SortOrder,
  SortState,
} from './contracts/data-grid'

export type { FbkRule, FormRules } from './contracts/form'
export type { ThemeBridge, ThemeMode } from './contracts/theme'
export { THEME_IS_DARK } from './contracts/theme'

export type {
  ConfirmApi,
  ConfirmOptions,
  FeedbackApi,
  MessageApi,
  MessageOptions,
  MessageType,
} from './contracts/feedback'

export { ADAPTER_CONTEXT, useAdapter, useAdapterCapabilities, useAdapterContext, useFbkTheme, useReporter } from './context'
export type { AdapterContext } from './context'
export { PERMISSION_CONTEXT, hasPermission, usePermission } from './permission'
export { createPermissionDirective } from './permission-directive'
export type { PermissionContext, PermissionResolver } from './permission'

export { createBusinessKit, createAdapterContext, FbkProvider } from './plugin'
export {
  NOOP_REPORTER,
  createReporter,
  safeContext,
  toErrorEvent,
} from './observability'
export type {
  FbkErrorEvent,
  FbkErrorSource,
  FbkReporter,
  FbkReporterOptions,
  FbkTelemetryEvent,
  FbkTelemetryType,
} from './observability'
export type { BusinessKitOptions } from './plugin'

export { getCellValue, renderCell } from './render'
