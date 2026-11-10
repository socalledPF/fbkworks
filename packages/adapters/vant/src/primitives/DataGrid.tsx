import { computed, defineComponent, type PropType } from 'vue'
import { Checkbox, List, Empty as VanEmpty, Loading } from 'vant'
import {
  renderCell,
  type DataGridColumn,
  type DataGridProps,
} from '@fbkworks/adapter-core'
import { getRowKey } from '@fbkworks/shared'

/**
 * vant 没有 Table。这里把同一份列描述渲染成卡片列表：
 * - column.mobile.primary 决定卡片主标题
 * - 其余列按 column.mobile.order 排列成 dt/dd
 * - column.mobile.hidden 的列不渲染
 * - loadMore 时接 van-list 触发 load-more
 */
export const DataGrid = defineComponent({
  name: 'FbkVantDataGrid',
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
    loadMore: Boolean,
    finished: Boolean,
    size: String,
  },
  emits: ['update:selectedKeys', 'update:sort', 'row-click', 'load-more'],
  setup(props, { attrs, emit, slots }) {
    const keyOf = (row: any, index: number) => getRowKey(row, index, props.rowKey)

    const visibleColumns = computed(() => props.columns.filter((column) => !column.mobile?.hidden))
    const primaryColumn = computed(
      () => visibleColumns.value.find((column) => column.mobile?.primary) ?? visibleColumns.value[0],
    )
    const restColumns = computed(() =>
      visibleColumns.value
        .filter((column) => column !== primaryColumn.value)
        .sort((a, b) => (a.mobile?.order ?? 99) - (b.mobile?.order ?? 99)),
    )

    const toggle = (row: any, index: number, checked: boolean) => {
      const key = keyOf(row, index)
      const next = new Set(props.selectedKeys)
      if (checked) next.add(key)
      else next.delete(key)
      emit('update:selectedKeys', [...next])
    }

    return () => (
      <div class="fbk-vant-grid" data-fbk-part="data-grid" {...attrs}>
        {props.data.length === 0 && !props.loading
          ? slots.empty
            ? slots.empty()
            : <VanEmpty description={props.emptyText ?? '暂无数据'} />
          : null}

        {props.data.map((row, index) => {
          const key = keyOf(row, index)
          return (
            <div
              key={String(key)}
              class="fbk-vant-grid__card"
              data-fbk-part="grid-row"
              data-row-key={String(key)}
              /* rowClickable 时卡片是可以点的，那就必须也能用键盘点。
                 不加 tabindex 的话键盘用户根本走不到这一行，整卡点击等于只对鼠标开放。 */
              tabindex={props.rowClickable ? 0 : undefined}
              /* 刻意不加 role="button"：卡片里还嵌着多选框，button 角色不允许包含
                 其他可交互元素，加了反而制造 ARIA 冲突。只补键盘可达性。 */
              onClick={(event: Event) => props.rowClickable && emit('row-click', row, index, event)}
              onKeydown={(event: KeyboardEvent) => {
                if (!props.rowClickable) return
                if (event.key !== 'Enter' && event.key !== ' ') return
                // 空格默认会滚动页面，必须先挡掉
                event.preventDefault()
                emit('row-click', row, index, event)
              }}
            >
              {props.selectionEnabled ? (
                <Checkbox
                  class="fbk-vant-grid__check"
                  /* 卡片没有列宽，selectionWidth 在这里的唯一合理落法是勾选框的点击热区 */
                  iconSize={Math.min(Math.max(props.selectionWidth - 28, 16), 28)}
                  modelValue={props.selectedKeys.includes(key)}
                  onClick={(event: Event) => event.stopPropagation()}
                  onUpdate:modelValue={(checked: boolean) => toggle(row, index, checked)}
                />
              ) : null}

              {primaryColumn.value ? (
                <div class="fbk-vant-grid__title">
                  {slots[`cell-${primaryColumn.value.key}`]?.({
                    row,
                    index,
                    value: renderCell(primaryColumn.value, row, index),
                  }) ?? renderCell(primaryColumn.value, row, index)}
                </div>
              ) : null}

              <dl class="fbk-vant-grid__fields">
                {restColumns.value.map((column) => (
                  /* data-numeric 供样式给等宽数字 —— 卡片里没有 <td>，
                     用属性选择器比再发明一个类名省事。 */
                  <div class="fbk-vant-grid__field" key={column.key} data-numeric={column.numeric || undefined}>
                    <dt>{column.mobile?.label ?? column.title}</dt>
                    <dd>
                      {slots[`cell-${column.key}`]?.({ row, index, value: renderCell(column, row, index) }) ??
                        renderCell(column, row, index)}
                    </dd>
                  </div>
                ))}
              </dl>

              {slots['card-footer']?.({ row, index })}
            </div>
          )
        })}

        {props.loadMore ? (
          <List
            loading={props.loading}
            finished={props.finished}
            finishedText="没有更多了"
            onLoad={() => emit('load-more')}
          />
        ) : null}

        {/* 不要求 data 非空：首屏 data 还是空数组时，Empty 被 loading 挡住，
            没有这条加载条整个列表区就是一片空白。 */}
        {props.loading && !props.loadMore ? (
          <div class="fbk-vant-grid__loading">
            <Loading size="20">加载中...</Loading>
          </div>
        ) : null}
      </div>
    )
  },
})
