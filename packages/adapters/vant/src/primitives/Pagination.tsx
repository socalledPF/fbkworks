import { computed, defineComponent, type PropType } from 'vue'
import { Pagination as VanPagination, Loading } from 'vant'

/** 移动端默认使用无限滚动；只有显式需要分页时才渲染 van-pagination。 */
export const Pagination = defineComponent({
  name: 'FbkVantPagination',
  inheritAttrs: false,
  props: {
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    total: { type: Number, default: 0 },
    pageSizes: { type: Array as PropType<number[]>, default: () => [] },
    showTotal: Boolean,
    showJumper: Boolean,
    size: String,
    disabled: Boolean,
    /* 默认值与 `capabilities.pagination.mode: 'infinite'` 对齐：
       以前这里是 'pages'，于是能力位声称无限滚动、直接使用原语却拿到页码分页器。 */
    mode: { type: String as PropType<'pages' | 'infinite'>, default: 'infinite' },
  },
  emits: ['update:page', 'update:pageSize'],
  setup(props, { attrs, emit }) {
    const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
    return () => (
      <div {...attrs}>
        {props.mode === 'infinite' ? (
          <div class="fbk-vant-pagination__infinite" data-fbk-part="pagination">
            <Loading size="20">{props.page >= pageCount.value ? '没有更多了' : '上拉加载更多'}</Loading>
          </div>
        ) : (
          <VanPagination
            data-fbk-part="pagination"
            modelValue={props.page}
            totalItems={props.total}
            itemsPerPage={props.pageSize}
            onUpdate:modelValue={(page: number) => emit('update:page', page)}
          />
        )}
      </div>
    )
  },
})
