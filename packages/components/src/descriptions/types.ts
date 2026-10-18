import type { VNodeChild } from 'vue'
import type { Size } from '@fbk/adapter-core'

export interface DescriptionItem<T = Record<string, any>> {
  key: string
  label: string
  dataIndex?: (keyof T & string) | string
  getValue?: (row: T) => unknown
  span?: number
  render?: (ctx: { row: T; value: unknown }) => VNodeChild
}

export interface DescriptionsProps<T = Record<string, any>> {
  items: DescriptionItem<T>[]
  data: T
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  bordered?: boolean
  direction?: 'horizontal' | 'vertical'
  size?: Size
  labelWidth?: string
}
