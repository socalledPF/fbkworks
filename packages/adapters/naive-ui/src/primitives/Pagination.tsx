import { defineComponent, inject, type PropType } from 'vue'
import { NPagination } from 'naive-ui'
import type { PaginationProps } from '@fbk/adapter-core'
import { PAGINATION_SUFFIX } from '../locale-context'

export const Pagination = defineComponent({
  name: 'FbkNaivePagination',
  inheritAttrs: false,
  props: {
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    total: { type: Number, default: 0 },
    pageSizes: { type: Array as PropType<number[]>, default: () => [10, 20, 50, 100] },
    showTotal: Boolean,
    showJumper: Boolean,
    size: { type: String as PropType<PaginationProps['size']>, default: 'md' },
    disabled: Boolean,
  },
  emits: ['update:page', 'update:pageSize'],
  setup(props, { attrs, emit }) {
    /* 跳页组的尾部单位字，由 RootProvider 按当前语言包注入。
       取不到时（单独 mount 组件、没有 provider）就退化为不显示。 */
    const suffix = inject(PAGINATION_SUFFIX, null)

    /* 选项文案。naive 默认把数字渲染成「20 / 页」，element-plus 是
       「20条/页」。同一个控件两种写法，视觉上分页块宽度也差一截。
       传 { label, value } 让两边文案一致。 */
    const sizeOptions = () =>
      props.pageSizes.map((size) => ({ label: `${size}条/页`, value: size }))

    /* 总数文案。element-plus 的 layout 里有 'total' 段，会渲染「共 N 条」；
       naive 没有等价能力，得自己补。不补的话两个适配器的分页宽度
       差 117px（实测 501 vs 384），右对齐时整块往右缩。 */
    return () => (
      <div class="fbk-pagination">
        {props.showTotal ? <span class="fbk-pagination__total">共 {props.total} 条</span> : null}
        <NPagination
          {...attrs}
          page={props.page}
          pageSize={props.pageSize}
          itemCount={props.total}
          pageSizes={sizeOptions()}
          showSizePicker
          /* 顺序对齐 element-plus 的默认 layout
             （total, sizes, prev, pager, next, jumper）：
             naive 默认把页码放最前面，每页条数在页码后面。 */
          displayOrder={['size-picker', 'pages', 'quick-jumper']}
          showQuickJumper={props.showJumper}
          /* 跳页组尾部补单位字。element-plus 是「前往 [1] 页」，
             naive 只有「跳至 [1]」。补上之后两边分页块等宽，
             而且这个字跟随 locale（zh「页」/ en「page」）。 */
          suffix={
            suffix?.value
              ? () => [<span class="fbk-pagination__suffix">{suffix.value}</span>]
              : undefined
          }
          disabled={props.disabled}
          onUpdate:page={(page: number) => emit('update:page', page)}
          onUpdate:pageSize={(size: number) => emit('update:pageSize', size)}
        />
      </div>
    )
  },
})
