<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, useAttrs, useSlots, watch, watchEffect } from 'vue'
import type { Slots } from 'vue'
import { useAdapter, useFbkTheme } from '@fbkworks/adapter-core'
import type { SortState } from '@fbkworks/adapter-core'
import type { Key, RowKeyGetter } from '@fbkworks/shared'
import { getRowKey } from '@fbkworks/shared'
import { FbkResult } from '../result'
import type { ProTableColumn, ProTableExpose, ProTableProps } from './types'
import { useTableRequest } from './use-table-request'
import { resolveColumnRenderer } from './value-renderer'

defineOptions({ name: 'FbkProTable', inheritAttrs: false })

const props = withDefaults(defineProps<ProTableProps<T>>(), {
  rowKey: 'id',
  data: undefined,
  request: undefined,
  params: () => ({}),
  loading: undefined,
  emptyText: '暂无数据',
  page: undefined,
  pageSize: undefined,
  total: undefined,
  pagination: undefined,
  selection: false,
  selectedKeys: undefined,
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:selectedKeys': [keys: Key[]]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'update:sort': [sort: SortState | null]
  'row-click': [row: T, index: number, event: Event]
  load: [result: { list: T[]; total?: number; hasMore?: boolean }, params: any]
  error: [error: unknown, params: any]
  refresh: []
}>()

const adapter = useAdapter()
const { locale } = useFbkTheme()
const slots: Slots = useSlots()
const { DataGrid, Pagination } = adapter.primitives

const innerPage = ref(props.page ?? 1)
const innerPageSize = ref(props.pageSize ?? 20)
/* 排序状态完全由表头交互驱动（onSort → 这里 → 请求）。
   以前从 props.sort 播种，但 DataGridProps.sort 删除后适配器不再接收它，
   播种就成了半死路径：错误重试重挂 DataGrid 时箭头全灭、而内部排序仍在生效。 */
const innerSort = ref<SortState | null>(null)
const innerSelected = ref<Key[]>(props.selectedKeys ?? [])

watch(() => props.page, (value) => value !== undefined && (innerPage.value = value))
watch(() => props.pageSize, (value) => value !== undefined && (innerPageSize.value = value))
watch(() => props.selectedKeys, (value) => value !== undefined && (innerSelected.value = value))

const isControlledData = computed(() => props.data !== undefined)
const isInfinite = computed(() => adapter.capabilities.pagination.mode === 'infinite')

const requestState = useTableRequest<T>({
  request: () => (isControlledData.value ? undefined : props.request),
  params: () => props.params,
  page: innerPage,
  pageSize: innerPageSize,
  sort: () => innerSort.value,
  append: () => isInfinite.value,
  onLoad: (result, params) => emit('load', result, params),
  onError: (error, params) => emit('error', error, params),
  // 内部改页码（触底、重置回第一页）也要让受控的 v-model:page 知道
  onPageChange: (page) => emit('update:page', page),
})

const rows = computed<T[]>(() => (isControlledData.value ? (props.data ?? []) : requestState.data.value))
const total = computed(() => props.total ?? requestState.total.value)
const loading = computed(() => props.loading ?? requestState.loading.value)

/**
 * 请求失败态。requestState.error 此前没人读 —— reject 后 data 仍是 []，
 * 表格渲染「暂无数据」，用户读到的是「没有数据」而不是「加载失败」。
 *
 * 受控 data 模式下 request 不会被调用，error 恒为 null；这里仍显式短路，
 * 避免运行时从 request 切到 data 后留下一块拆不掉的错误页。
 */
const errorState = computed(() => (isControlledData.value ? null : requestState.error.value))

const errorSubtitle = computed(() =>
  errorState.value instanceof Error ? errorState.value.message : String(errorState.value),
)

const selectionEnabled = computed(
  () => props.selection !== false && adapter.capabilities.dataGrid.selection,
)

/** 只在真的渲染选择列时才读，避免 false/{} 两种写法各写一套取值逻辑 */
const selectionOptions = computed(() => (typeof props.selection === 'object' ? props.selection : {}))

const selectionWidth = computed(() => selectionOptions.value.columnWidth ?? 48)
/** 默认 true：翻页后保留已选行，这是 ProTable 的既有行为 */
const preserveOnReload = computed(() => selectionOptions.value.preserveOnReload ?? true)

const columns = computed<ProTableColumn<T>[]>(() =>
  props.columns
    .filter((column) => !column.hideInTable)
    .map((column) =>
      resolveColumnRenderer(column, {
        Tag: adapter.primitives.Tag,
        // locale 是一等公民：业务侧把 createBusinessKit 的 locale 设成 en-US 后，
        // 金额与日期要跟着变。L1 不读注入上下文，所以在这里显式传下去。
        locale: locale.value,
      }),
    ),
)

const gridProps = computed(() => ({
  ...(props.uiProps?.grid ?? {}),
  columns: columns.value,
  data: rows.value,
  rowKey: props.rowKey,
  loading: loading.value,
  selectionEnabled: selectionEnabled.value,
  selectionWidth: selectionWidth.value,
  selectedKeys: innerSelected.value,
  emptyText: props.emptyText,
  rowClickable: true,
  loadMore: isInfinite.value && !isControlledData.value && props.pagination !== false,
  finished: requestState.finished.value,
}))

const showPagination = computed(
  () =>
    props.pagination !== false &&
    !isControlledData.value &&
    !isInfinite.value &&
    !errorState.value,
)

/**
 * `pagination` 有两种形态（false / 配置对象），原先三处各写一遍
 * `typeof pagination === 'object' ? ... : 默认值`，改一处就容易漏另一处。
 * 这里收敛成一个对象，模板只读字段。
 */
const paginationOptions = computed(() => {
  const options = typeof props.pagination === 'object' ? props.pagination : {}
  return {
    pageSizes: options.pageSizes,
    showTotal: options.showTotal ?? true,
    showJumper: options.showJumper ?? true,
  }
})

/** 空对象而不是 undefined：让模板里 v-bind 的写法统一，不必每处写可选链 */
const toolbarAttrs = computed(() => props.uiProps?.toolbar ?? {})
const paginationAttrs = computed(() => props.uiProps?.pagination ?? {})

const forwardedCellSlots = computed<string[]>(() =>
  columns.value.map((column) => column.key).filter((key) => Boolean(slots[`cell-${key}`])),
)

function onSelectedKeys(keys: Key[]) {
  innerSelected.value = keys
  emit('update:selectedKeys', keys)
}

/* ------------------------------------------------------------------
   表头全选
   适配器的选择列只能勾单行，表头那个「全选」框由 ProTable 自己渲染，
   这样才能同时兼容三种适配器（vant 的卡片列表根本没有表头）。
   ------------------------------------------------------------------ */

const rowKeys = computed<Key[]>(() =>
  rows.value.map((row, index) => getRowKey(row, index, props.rowKey as RowKeyGetter<T>)),
)

const allSelected = computed(
  () => rowKeys.value.length > 0 && rowKeys.value.every((key) => innerSelected.value.includes(key)),
)

const someSelected = computed(
  () => !allSelected.value && rowKeys.value.some((key) => innerSelected.value.includes(key)),
)

/** indeterminate 只能通过 DOM 属性设置 */
const selectAllRef = ref<HTMLInputElement>()
watchEffect(() => {
  if (selectAllRef.value) selectAllRef.value.indeterminate = someSelected.value
})

function toggleSelectAll(checked: boolean) {
  const current = new Set(innerSelected.value)
  if (checked) rowKeys.value.forEach((key) => current.add(key))
  else rowKeys.value.forEach((key) => current.delete(key))
  onSelectedKeys([...current])
}

function onSort(sort: SortState | null) {
  innerSort.value = sort
  emit('update:sort', sort)
  /* 排序变化等于换了一次查询，必须回到第一页 —— 但页码是受控的，
     直接写 innerPage 会让父级的 URL 与真实请求页不一致，所以走 onPage。 */
  if (!isControlledData.value && innerPage.value !== 1) onPage(1)
}

function onPage(page: number) {
  innerPage.value = page
  emit('update:page', page)
}

function onPageSize(size: number) {
  innerPageSize.value = size
  emit('update:pageSize', size)
  if (innerPage.value !== 1) onPage(1)
}

async function reload(options: { resetPage?: boolean } = {}) {
  emit('refresh')
  /* 清空选中必须 emit：selectedKeys 是受控 prop，只改内部值的话
     父级的 v-model 仍停在旧值 —— 父级自己渲染的批量操作栏会显示「已选 1 项」
     并可以执行删除，而表格里其实已经一个都没勾。clearSelection 一直是正确 emit 的，
     只有这条路径漏了。
     而且它要放在「受控 data 直接返回」之前：否则 selection.preserveOnReload: false
     配 :data 时是彻底的空操作。 */
  if (!preserveOnReload.value && innerSelected.value.length > 0) {
    innerSelected.value = []
    emit('update:selectedKeys', [])
  }
  if (isControlledData.value) return
  if (isInfinite.value) requestState.finished.value = false
  await requestState.reload(options)
}

/** 显式转一层：插槽把 retry 当 onClick 用时会把 MouseEvent 传进 options */
function retry() {
  return reload()
}

function clearSelection() {
  innerSelected.value = []
  emit('update:selectedKeys', [])
}

function setSelectedKeys(keys: Key[]) {
  innerSelected.value = keys
  emit('update:selectedKeys', keys)
}

defineExpose<ProTableExpose<T>>({
  reload,
  getData: () => rows.value,
  clearSelection,
  setSelectedKeys,
})
</script>

<template>
  <div class="fbk-pro-table" v-bind="attrs" :class="{ 'fbk-pro-table--cards': adapter.capabilities.dataGrid.presentation === 'cards' }">

    <!-- toolbar 默认 true 只表示「允许工具栏」。没有插槽时不该渲染容器 ——
         虽然 :empty 能兜住，但少一个空节点对可访问性和 DOM 快照都更干净。 -->
    <div v-if="$slots.toolbar" class="fbk-pro-table__toolbar" v-bind="toolbarAttrs">
      <slot name="toolbar" :selected-keys="innerSelected" :reload="reload" />
    </div>

    <!-- 表头全选 + 批量操作。
         位置在工具栏**之后**：主操作（新建/导出）是常驻的，应该在上面；
         批量条是选中后才出现的次要操作，紧贴表格更符合后台惯例。
         早期放在工具栏之前，导致「新建」被挤到批量条下方，层级颠倒。
         卡片模式（vant）没有表头，放在工具栏里反而更自然。 -->
    <div
      v-if="selectionEnabled && rowKeys.length > 0 && !errorState"
      class="fbk-pro-table__bulk"
      :class="{ 'fbk-pro-table__bulk--cards': adapter.capabilities.dataGrid.presentation === 'cards' }"
    >
      <label class="fbk-pro-table__select-all">
        <!-- indeterminate 是 DOM 属性不是 HTML attribute，:indeterminate 绑定不会生效，
             必须用 ref 手动写。否则「部分选中」显示成未选中，用户会误以为没选。 -->
        <input
          ref="selectAllRef"
          type="checkbox"
          :checked="allSelected"
          @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
        />
        <span>全选当前页</span>
      </label>
      <span v-if="innerSelected.length" class="fbk-pro-table__selected-count">
        已选 {{ innerSelected.length }} 项
      </span>
      <slot name="bulk-actions" :selected-keys="innerSelected" :clear="clearSelection" />
    </div>

    <!-- 失败时整块换成错误态，不叠在表格上方：翻页失败时 data 里
         还留着上一页的行，错误提示与旧数据并存，用户分不清看到的是哪一页。 -->
    <div v-if="errorState" class="fbk-pro-table__error">
      <slot name="error" :error="errorState" :retry="retry">
        <FbkResult status="error" title="加载失败" :subtitle="errorSubtitle">
          <template #default>
            <button type="button" class="fbk-pro-table__retry" @click="retry">重试</button>
          </template>
        </FbkResult>
      </slot>
    </div>

    <component
      v-else
      :is="DataGrid"
      v-bind="gridProps"
      @update:selected-keys="onSelectedKeys"
      @update:sort="onSort"
      @row-click="(row: T, index: number, event: Event) => emit('row-click', row, index, event)"
      @load-more="requestState.loadMore"
    >
      <!-- 只转发用户真正提供的插槽，避免空插槽覆盖适配器的默认单元格渲染 -->
      <template v-for="key in forwardedCellSlots" #[`cell-${key}`]="slotProps" :key="key">
        <slot :name="`cell-${key}`" v-bind="slotProps" />
      </template>
      <template v-if="$slots['card-footer']" #card-footer="slotProps">
        <slot name="card-footer" v-bind="slotProps" />
      </template>
      <!-- 空态同理：只有业务方真的传了才转发，否则适配器用自己的默认空态 -->
      <template v-if="$slots.empty" #empty="slotProps">
        <slot name="empty" v-bind="slotProps" />
      </template>
    </component>

    <div v-if="showPagination" class="fbk-pro-table__pagination" v-bind="paginationAttrs">
      <component
        :is="Pagination"
        :page="innerPage"
        :page-size="innerPageSize"
        :total="total"
        :page-sizes="paginationOptions.pageSizes"
        :show-total="paginationOptions.showTotal"
        :show-jumper="paginationOptions.showJumper"
        @update:page="onPage"
        @update:page-size="onPageSize"
      />
    </div>
  </div>
</template>
