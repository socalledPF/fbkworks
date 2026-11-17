import { computed, defineComponent, type PropType } from 'vue'
import { ElPagination } from 'element-plus'
import type { PaginationProps } from '@fbkworks/adapter-core'

export const Pagination = defineComponent({
  name: 'FbkElPagination',
  inheritAttrs: false,
  props: {
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    total: { type: Number, default: 0 },
    pageSizes: { type: Array as PropType<number[]>, default: () => [10, 20, 50, 100] },
    /* 缺省 true：契约里 showTotal 是「可以关掉」的开关，而 Boolean prop 缺省会被 Vue 转成 false ——
       不显式给默认值的话，所有没传 showTotal 的分页器都会静默丢掉总数。 */
    showTotal: { type: Boolean, default: true },
    showJumper: Boolean,
    /* mode 是契约里的字段，但 element-plus 只有分页形态（没有无限滚动）——
       声明它只是为了让 Vue 消费掉，否则会经 {...attrs} 落成 <div mode="pages"> 这种非法属性。 */
    mode: { type: String as PropType<PaginationProps['mode']>, default: undefined },
    size: { type: String as PropType<PaginationProps['size']>, default: 'md' },
    disabled: Boolean,
  },
  emits: ['update:page', 'update:pageSize'],
  setup(props, { attrs, emit }) {
    const layout = computed(() => {
      /* total 不是恒定的：契约声明了 showTotal，以前 layout 里无条件带它，
         于是 `:pagination="{ showTotal: false }"` 在 element-plus 上无效、在 naive-ui 上生效。 */
      const parts: string[] = []
      if (props.showTotal) parts.push('total')
      parts.push('sizes', 'prev', 'pager', 'next')
      if (props.showJumper) parts.push('jumper')
      return parts.join(', ')
    })
    return () => (
      <ElPagination
        {...attrs}
        currentPage={props.page}
        pageSize={props.pageSize}
        total={props.total}
        pageSizes={props.pageSizes}
        layout={layout.value}
        disabled={props.disabled}
        onUpdate:current-page={(page: number) => emit('update:page', page)}
        onUpdate:page-size={(size: number) => emit('update:pageSize', size)}
      />
    )
  },
})
