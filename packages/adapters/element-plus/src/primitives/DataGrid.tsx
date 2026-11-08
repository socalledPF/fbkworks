import { computed, defineComponent, withDirectives, type PropType } from 'vue'
import { ElTable, ElTableColumn, vLoading } from 'element-plus'
import {
  renderCell,
  type DataGridColumn,
  type DataGridProps,
  type SortState,
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
    presentation: { type: String as PropType<DataGridProps['presentation']>, default: 'auto' },
    selectionEnabled: Boolean,
    selectionWidth: { type: Number, default: 48 },
    selectedKeys: { type: Array as PropType<Array<string | number>>, default: () => [] },
    sort: { type: Object as PropType<SortState | null>, default: null },
    emptyText: String,
    rowClickable: Boolean,
    size: { type: String, default: 'md' },
  },
  emits: ['update:selectedKeys', 'update:sort', 'row-click'],
  setup(props, { attrs, emit, slots }) {
    const rowKeyOf = (row: any, index: number) => getRowKey(row, index, props.rowKey)

    const elementSize = computed(() =>
      props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'default',
    )

    /* element-plus 没有独立 Spin，loading 只能靠 v-loading 指令挂遮罩；
       这里用 withDirectives 直接绑指令对象，不要求业务侧全局注册 v-loading。 */
    return () => withDirectives(
      <ElTable
        {...attrs}
        v-slots={slots.empty ? { empty: () => slots.empty!() } : undefined}
        data={props.data}
        rowKey={props.rowKey as any}
        size={elementSize.value}
        emptyText={props.emptyText ?? '暂无数据'}
        defaultSort={props.sort ? { prop: props.sort.field, order: props.sort.order === 'asc' ? 'ascending' : 'descending' } : undefined}
        onSelection-change={(rows: any[]) =>
          emit('update:selectedKeys', rows.map((row) => rowKeyOf(row, props.data.indexOf(row))))
        }
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
