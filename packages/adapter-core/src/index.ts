export const ADAPTER_API_VERSION = 1

export type {
  AdapterMeta,
  Capabilities,
  UiAdapter,
  UiPrimitives,
} from './contracts/adapter'
export { assertAdapterCompatible } from './contracts/adapter'

export type {
  ButtonProps,
  ButtonVariant,
  CheckboxEmits,
  CheckboxProps,
  DialogProps,
  EmptyProps,
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

export { ADAPTER_CONTEXT, useAdapter, useAdapterCapabilities, useAdapterContext, useFbkTheme } from './context'
export type { AdapterContext } from './context'

export { createBusinessKit, createAdapterContext, FbkProvider } from './plugin'
export type { BusinessKitOptions } from './plugin'

export { getCellValue, renderCell } from './render'
