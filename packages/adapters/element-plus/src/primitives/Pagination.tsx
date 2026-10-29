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
    showTotal: Boolean,
    showJumper: Boolean,
    size: { type: String as PropType<PaginationProps['size']>, default: 'md' },
    disabled: Boolean,
  },
  emits: ['update:page', 'update:pageSize'],
  setup(props, { attrs, emit }) {
    const layout = computed(() => {
      const parts = ['total', 'sizes', 'prev', 'pager', 'next']
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
