import { computed, defineComponent, nextTick, onMounted, ref, watch, withDirectives, type PropType } from 'vue'
import { ElTable, ElTableColumn, vLoading } from 'element-plus'
import {
  renderCell,
  type DataGridColumn,
  type DataGridProps,
} from '@fbkworks/adapter-core'
import { getRowKey } from '@fbkworks/shared'

export const DataGrid = defineComponent({
  name: 'FbkElDataGrid',
  inheritAttrs: false,
  props: {
    columns: { type: Array as PropType<DataGridColumn<any>[]>, default: () => [] },
    data: { type: Array as PropType<any[]>, default: () => [] },
    rowKey: { type: [String, Function] as PropType<DataGridProps['rowKey']>, default: 'id' },
    loading: Boolean,
    selectionEnabled: Boolean,
    selectionWidth: { type: Number, default: 48 },
    selectedKeys: { type: Array as PropType<Array<string | number>>, default: () => [] },
    emptyText: String,
    /* 这两个是「无限滚动」这一族的能力位驱动字段，只有 vant 会真的用。
       桌面端必须**声明**它们，否则 ProTable 无条件传过来时会落进 attrs，
       再被 {...attrs} 展开到表格根节点，变成 loadmore="false" finished="false"
       这种非法 DOM 属性，连 @load-more 都会变成原生事件监听器。 */
    loadMore: Boolean,
    finished: Boolean,
    rowClickable: Boolean,
    size: { type: String, default: 'md' },
  },
  emits: ['update:selectedKeys', 'update:sort', 'row-click'],
  setup(props, { attrs, emit, slots }) {
    const rowKeyOf = (row: any, index: number) => getRowKey(row, index, props.rowKey)

    /* ---------- 受控选择 ----------
       `selectedKeys` 是**受控** prop（ProTable 的 clearSelection、父级重置勾选都靠它），
       而这个适配器以前只声明了它、从不读 —— 于是 naive/vant 能跟着外部状态走，
       element-plus 却只有「用户点了才动」：父级把 selectedKeys 置空后勾选框仍然勾着。
       一致性套件过去只断言「点击会 emit」，所以这个洞一直没被发现。
       下面把 props.selectedKeys 真的映射到 ElTable 的选择状态上。 */
    const tableRef = ref<any>(null)
    /* 由我们自己触发的 toggleRowSelection 会同步触发 selection-change。
       不挡住的话会「外部置空 → 组件回写非空」，形成值抖动。 */
    let syncing = false

    const applySelection = () => {
      const table = tableRef.value
      if (!table || !props.selectionEnabled) return
      syncing = true
      table.clearSelection?.()
      props.data.forEach((row, index) => {
        if (props.selectedKeys.includes(rowKeyOf(row, index))) table.toggleRowSelection(row, true)
      })
      /* ElTable 在 toggleRowSelection 里同步派发 selection-change，
         所以这里放行要等一个 tick，避免把同步流程里的那次 emit 漏挡。 */
      void nextTick(() => {
        syncing = false
      })
    }

    onMounted(applySelection)
    watch(() => props.selectedKeys, applySelection, { deep: true })
    watch(() => props.data, applySelection)
    watch(() => props.selectionEnabled, applySelection)

    const onSelectionChange = (rows: any[]) => {
      if (syncing) return
      emit(
        'update:selectedKeys',
        rows.map((row) => rowKeyOf(row, props.data.indexOf(row))),
      )
    }

    const elementSize = computed(() =>
      props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'default',
    )

    /* element-plus 没有独立 Spin，loading 只能靠 v-loading 指令挂遮罩；
       这里用 withDirectives 直接绑指令对象，不要求业务侧全局注册 v-loading。 */
    return () => withDirectives(
      <ElTable
        {...attrs}
        ref={tableRef}
        /* loading 期间不渲染空态：首帧 data 一定是空的，此时喊「暂无数据」
           等于把「正在加载」说成「没有数据」。vant 一直是这么做的，
           桌面端两库此前没有 —— 同一份业务代码换库外观就不一样。
           传空插槽而不是空字符串：el-table 对空字符串仍会渲染它自己的默认空态。 */
        v-slots={
          props.loading
            ? { empty: () => null }
            : slots.empty
              ? { empty: () => slots.empty!() }
              : undefined
        }
        data={props.data}
        rowKey={props.rowKey as any}
        size={elementSize.value}
        /* loading 期间两者一起关：只关插槽不够 —— el-table 在插槽渲染出空内容时
           仍会回落到 emptyText。 */
        emptyText={props.loading ? '' : (props.emptyText ?? '暂无数据')}
        onSelection-change={onSelectionChange}
        onSort-change={({ prop, order }: { prop: string | null; order: string | null }) =>
          emit(
            'update:sort',
            order && prop ? { field: prop, order: order === 'ascending' ? 'asc' : 'desc' } : null,
          )
        }
        onRow-click={(row: any, _column: any, event: Event) => {
          if (!props.rowClickable) return
          emit('row-click', row, props.data.indexOf(row), event)
        }}
      >
        {props.selectionEnabled ? (
          <ElTableColumn type="selection" width={props.selectionWidth} reserveSelection />
        ) : null}
        {props.columns.map((column) => (
          <ElTableColumn
            key={column.key}
            /* prop 同时是 sort-change 回传的字段名：dataIndex 可选，
               缺省时回退 key，否则点击排序只会发出 null。 */
            prop={(column.dataIndex ?? column.key) as string}
            label={column.title}
            width={column.width}
            minWidth={column.minWidth}
            fixed={column.fixed}
            align={column.align}
            sortable={column.sortable ? 'custom' : false}
            showOverflowTooltip={column.ellipsis}
            /* 数值列加 .fbk-numeric，由适配器样式给等宽数字。
               className 是 el-table-column 的官方 prop（落在 <td> 上），
               比自己拼 class 稳。 */
            className={column.numeric ? 'fbk-numeric' : undefined}
            v-slots={{
              default: ({ row, $index }: { row: any; $index: number }) =>
                slots[`cell-${column.key}`]?.({ row, index: $index, value: renderCell(column, row, $index) }) ??
                renderCell(column, row, $index),
            }}
          />
        ))}
      </ElTable>,
      [[vLoading, props.loading]],
    )
  },
})
