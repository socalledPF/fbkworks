export interface BreadcrumbItem {
  text: string
  /** 只接收字符串，避免组件库依赖 vue-router */
  to?: string
}

export interface PageContainerProps {
  title?: string
  subtitle?: string
  back?: boolean | (() => void)
  breadcrumbs?: BreadcrumbItem[]
  loading?: boolean
  fixedHeader?: boolean
  showHeader?: boolean
  showFooter?: boolean
  maxWidth?: string | number
  uiProps?: { header?: Record<string, any>; backButton?: Record<string, any> }
}
