import { h, type VNodeChild } from 'vue'
import { formatDate, formatMoney, formatNumber } from '@fbk/shared'
import type { CellRenderContext } from '@fbk/adapter-core'
import type { ProTableColumn } from './types'

interface RendererContext {
  /** 适配器提供的 Tag 原语。显式传入而不是从适配器上下文里取，方便单测。 */
  Tag: any
  /**
   * 数字/日期的格式化 locale，来自 `useFbkTheme().locale`。
   * L1 是纯函数层，不读注入上下文，所以由这里显式传下去。
   */
  locale?: string
}

/**
 * 把单元格内容包上列级的「展示外壳」：`tooltip` 与 `copyable`。
 *
 * 这两项原先只在类型里声明、没有任何实现 —— 业务侧写了 `copyable: true`
 * 什么也不会发生。这是最坏的一类 API 缺陷：不报错，也不生效。
 *
 * 外壳顺序固定为 tooltip 在外、copyable 在内：复制按钮必须能独立点击，
 * 不能被 tooltip 的 title 区整个包住。
 */
function wrapCell(content: VNodeChild, column: ProTableColumn<any>, raw: unknown): VNodeChild {
  if (!column.copyable && !column.tooltip) return content

  const text = raw === null || raw === undefined || raw === '' ? undefined : String(raw)

  let cell: VNodeChild = content

  // 没有可复制的值（空单元格）时连容器都不包：否则会留下一个空的 inline-flex，
  // 在 flex 布局的单元格里凭空多出一段间距。
  if (column.copyable && text) {
    cell = h('span', { class: 'fbk-pro-table__copyable' }, [
      cell as any,
      h('button', {
        type: 'button',
        class: 'fbk-pro-table__copy',
        'aria-label': `复制${column.title}`,
        title: `复制${column.title}`,
        'data-copy-text': text,
        onClick: (event: MouseEvent) => {
          // 行本身可点击，复制按钮不能顺带把行点开
          event.stopPropagation()
          void navigator.clipboard?.writeText(text)
        },
      }, '⧉'),
    ])
  }

  if (column.tooltip) {
    cell = h('span', { class: 'fbk-pro-table__tip', title: column.tooltip }, [cell as any])
  }

  return cell
}

/** valueType → 纯内容。业务语义（金额、日期、枚举、标签）都在这里收敛。 */
function renderByValueType(
  ctx: CellRenderContext<any>,
  components: RendererContext,
): VNodeChild {
  const { value, column } = ctx
  const proColumn = column as ProTableColumn<any>
  const valueEnum = proColumn.valueEnum
  // 调用方没给 locale 时用 L1 的默认值（zh-CN），保持既有行为
  const locale = components.locale

  switch (proColumn.valueType) {
    case 'number':
      return formatNumber(value, undefined, locale)
    case 'money':
      return formatMoney(value, 2, locale)
    case 'date':
      return formatDate(value, 'date', locale)
    case 'datetime':
      return formatDate(value, 'datetime', locale)
    case 'enum': {
      const item = valueEnum?.[value as string | number]
      if (!item) return value === null || value === undefined ? '-' : String(value)
      return h(components.Tag, { status: item.status ?? 'default' }, () => item.text)
    }
    case 'tag':
      return h(
        components.Tag,
        { status: 'default' },
        () => (value === null || value === undefined ? '-' : String(value)),
      )
    case 'image':
      return value
        ? h('img', {
            src: String(value),
            alt: '',
            style: 'width:32px;height:32px;object-fit:cover;border-radius:4px',
          })
        : '-'
    default:
      return value === null || value === undefined || value === '' ? '-' : String(value)
  }
}

/**
 * 把业务 valueType 解析成 column.render。
 * 适配器只负责排版，业务语义全部在这里收敛。
 */
export function resolveColumnRenderer<T extends Record<string, any>>(
  column: ProTableColumn<T>,
  components: RendererContext,
): ProTableColumn<T> {
  const hasShell = Boolean(column.copyable || column.tooltip)

  // 显式 render / actions 列：只在外壳存在时才重新包一层，否则原样返回
  if (column.render || !column.valueType || column.valueType === 'actions') {
    if (!hasShell || !column.render) return column
    const userRender = column.render
    return {
      ...column,
      render: (ctx) => wrapCell(userRender(ctx) as VNodeChild, column, ctx.value),
    }
  }

  const valueType = column.valueType
  // 数值列标记出来，由适配器加等宽数字。用户显式写的 numeric 优先。
  const numeric = column.numeric ?? (valueType === 'number' || valueType === 'money')

  return {
    ...column,
    numeric,
    render: (ctx) => wrapCell(renderByValueType(ctx, components), column, ctx.value),
  }
}
