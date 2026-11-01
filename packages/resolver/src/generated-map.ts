/**
 * 由 `scripts/gen-resolver-map.mjs` 生成，请勿手改。
 * 改这个文件等于在改一份会被覆盖的副本 —— 要加组件就去加组件目录。
 *
 * 之所以把映射落成文件而不是运行时读文件系统：resolver 是发布包，
 * 不能依赖构建期的目录结构。
 */

export interface ResolverEntry {
  /** `@fbkworks/components` 之后的子路径 */
  subpath: string
  /** 样式副作用入口；组件没有自己的 style.css 时为 undefined */
  style: string | undefined
}

export const componentMap: Record<string, ResolverEntry> = {
  FbkCrudPage: { subpath: 'crud-page', style: '@fbkworks/components/crud-page/style.css' },
  FbkDescriptions: { subpath: 'descriptions', style: '@fbkworks/components/descriptions/style.css' },
  FbkDetailDrawer: { subpath: 'detail-drawer', style: undefined },
  FbkDetailPage: { subpath: 'detail-page', style: '@fbkworks/components/detail-page/style.css' },
  FbkFormGenerator: { subpath: 'form-generator', style: '@fbkworks/components/form-generator/style.css' },
  FbkFormModal: { subpath: 'form-modal', style: '@fbkworks/components/form-modal/style.css' },
  FbkPageContainer: { subpath: 'page-container', style: '@fbkworks/components/page-container/style.css' },
  FbkProTable: { subpath: 'pro-table', style: '@fbkworks/components/pro-table/style.css' },
  FbkQueryForm: { subpath: 'query-form', style: '@fbkworks/components/query-form/style.css' },
  FbkResult: { subpath: 'result', style: '@fbkworks/components/result/style.css' },
}
