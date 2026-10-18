import { h } from 'vue'
import { formatDate, formatMoney, formatNumber } from '@fbk/shared'
import type { ProTableColumn } from './types'

/**
 * 把业务 valueType 解析成 column.render。
 * 适配器只负责排版，业务语义（金额、日期、枚举、标签）全部在这里收敛。
 */
export function resolveColumnRenderer<T extends Record<string, any>>(
  column: ProTableColumn<T>,
  components: { Tag: any },
): ProTableColumn<T> {
  if (column.render || !column.valueType || column.valueType === 'actions') return column

  const valueType = column.valueType
  const valueEnum = column.valueEnum
  // 数值列标记出来，由适配器加等宽数字。用户显式写的 numeric 优先。
  const numeric = column.numeric ?? (valueType === 'number' || valueType === 'money')

  return {
    ...column,
    numeric,
    render: ({ value }) => {
      switch (valueType) {
        case 'number':
          return formatNumber(value)
        case 'money':
          return formatMoney(value)
        case 'date':
          return formatDate(value, 'date')
        case 'datetime':
          return formatDate(value, 'datetime')
        case 'enum': {
          const item = valueEnum?.[value as string | number]
          if (!item) return value === null || value === undefined ? '-' : String(value)
          return h(components.Tag, { status: item.status ?? 'default' }, () => item.text)
        }
        case 'tag':
          return h(components.Tag, { status: 'default' }, () => (value === null || value === undefined ? '-' : String(value)))
        case 'image':
          return value ? h('img', { src: String(value), style: 'width:32px;height:32px;object-fit:cover;border-radius:4px' }) : '-'
        default:
          return value === null || value === undefined || value === '' ? '-' : String(value)
      }
    },
  }
}
