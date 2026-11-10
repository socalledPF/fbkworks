import { computed, defineComponent, type PropType } from 'vue'
import { NDataTable, NEmpty, type DataTableColumns } from 'naive-ui'
import {
  renderCell,
  type DataGridColumn,
  type DataGridProps,
} from '@fbkworks/adapter-core'
import { getRowKey } from '@fbkworks/shared'

export const DataGrid = defineComponent({
  name: 'FbkNaiveDataGrid',
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
    rowClickable: Boolean,
    size: { type: String, default: 'md' },
  },
  emits: ['update:selectedKeys', 'update:sort', 'row-click'],
  setup(props, { attrs, emit, slots }) {
    const keyOf = (row: any, index: number) => getRowKey(row, index, props.rowKey)

    const naiveColumns = computed<DataTableColumns<any>>(() => {
      const result: DataTableColumns<any> = []
      if (props.selectionEnabled) {
        result.push({ type: 'selection', width: props.selectionWidth } as any)
      }
      for (const column of props.columns) {
        result.push({
          key: column.key,
          title: column.title,
          width: column.width,
          minWidth: column.minWidth,
          fixed: column.fixed,
          align: column.align,
          ellipsis: column.ellipsis
            ? { tooltip: true }
            : undefined,
          /* `true`（可排序但没有比较函数）= 「只发 update:sorter，不本地排序」，
             与 element-plus 的 sortable:'custom' 语义一致。
             以前这里是 `'default'`，naive-ui 会在本地把当前页重排一遍 ——
             服务端分页时等于对当前页二次排序，且与桌面端行序不同，
             而能力位却声明 sort:'custom'（只发事件），说法与实现相反。
             注意 naive 的类型里没有 'custom' 这个字面量，等价写法是 `true`。 */
          sorter: column.sortable ? true : false,
          /* 数值列加 .fbk-numeric，由适配器样式给等宽数字。
             naive 的 className 落在 <td> 上。 */
          className: column.numeric ? 'fbk-numeric' : undefined,
          render: (row: any, index: number) =>
            (slots[`cell-${column.key}`]?.({ row, index, value: renderCell(column, row, index) }) ??
              renderCell(column, row, index)) as any,
        })
      }
      return result
    })

    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))

    return () => (
      <NDataTable
        {...attrs}
        columns={naiveColumns.value}
        data={props.data}
        rowKey={(row: any) => keyOf(row, props.data.indexOf(row)) as any}
        checkedRowKeys={props.selectedKeys as any}
        loading={props.loading}
        size={size.value}
        v-slots={{
          empty: () => (slots.empty ? slots.empty() : <NEmpty description={props.emptyText ?? '暂无数据'} />),
        }}
        onUpdate:checkedRowKeys={(keys: Array<string | number>) => emit('update:selectedKeys', keys)}
        onUpdate:sorter={(sorter: any) => {
          if (!sorter || !sorter.order) {
            emit('update:sort', null)
            return
          }
          /* 列的 key 只用于定位（sorter.columnKey 就是它），
             update:sort 的 field 取 dataIndex、缺省回退 key —— 与 element-plus 同一语义。 */
          const columnKey = String(sorter.columnKey ?? sorter.column?.key)
          const source = props.columns.find((column) => column.key === columnKey)
          emit('update:sort', {
            field: String(source?.dataIndex ?? columnKey),
            order: sorter.order === 'ascend' ? 'asc' : 'desc',
          })
        }}
        onUpdate:page={() => {}}
        rowProps={(row: any) => ({
          style: props.rowClickable ? 'cursor: pointer' : undefined,
          onClick: (event: Event) => {
            if (!props.rowClickable) return
            emit('row-click', row, props.data.indexOf(row), event)
          },
        })}
      />
    )
  },
})
