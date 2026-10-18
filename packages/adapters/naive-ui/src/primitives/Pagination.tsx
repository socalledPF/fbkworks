import { defineComponent, type PropType } from 'vue'
import { NPagination } from 'naive-ui'
import type { PaginationProps } from '@fbk/adapter-core'

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
    return () => (
      <NPagination
        {...attrs}
        page={props.page}
        pageSize={props.pageSize}
        itemCount={props.total}
        pageSizes={props.pageSizes}
        showSizePicker
        showQuickJumper={props.showJumper}
        disabled={props.disabled}
        onUpdate:page={(page: number) => emit('update:page', page)}
        onUpdate:pageSize={(size: number) => emit('update:pageSize', size)}
      />
    )
  },
})
