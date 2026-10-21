/**
 * Barrel 只做 re-export，不 import CSS —— 保证 tree-shaking。
 * 样式按子路径显式导入：`@fbk/components/pro-table/style.css`。
 */
export { FbkProTable, useTableRequest } from './pro-table'
export type {
  ProTableAction,
  ProTableActionContext,
  ProTableColumn,
  ProTableExpose,
  ProTableProps,
  ProTableUiProps,
  TableRequest,
  TableRequestParams,
  TableResponse,
  ValueEnumItem,
  ValueType,
} from './pro-table'

export { FbkCrudPage } from './crud-page'
export type { CrudPageExpose, CrudPageProps, CrudPageSlots } from './crud-page'

export { FbkQueryForm } from './query-form'
export type { QueryField, QueryFieldType, QueryFormExpose, QueryFormProps } from './query-form'

export { FbkFormGenerator } from './form-generator'
export type {
  FormField,
  FormFieldType,
  FormGeneratorExpose,
  FormGeneratorProps,
  FormGroup,
  FormSchema,
} from './form-generator'

export { FbkPageContainer } from './page-container'
export type { BreadcrumbItem, PageContainerProps } from './page-container'

export { FbkDescriptions } from './descriptions'
export type { DescriptionItem, DescriptionsProps } from './descriptions'
