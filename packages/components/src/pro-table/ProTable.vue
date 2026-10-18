<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, useSlots, watch } from 'vue'
import type { Slots } from 'vue'
import { useAdapter } from '@fbk/adapter-core'
import type { SortState } from '@fbk/adapter-core'
import type { Key } from '@fbk/shared'
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
  presentation: 'auto',
  page: undefined,
  pageSize: undefined,
  total: undefined,
  pagination: undefined,
  selection: false,
  selectedKeys: undefined,
  sort: undefined,
  toolbar: true,
})

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
const slots: Slots = useSlots()
const { DataGrid, Pagination } = adapter.primitives

const innerPage = ref(props.page ?? 1)
const innerPageSize = ref(props.pageSize ?? 20)
const innerSort = ref<SortState | null>(props.sort ?? null)
const innerSelected = ref<Key[]>(props.selectedKeys ?? [])

watch(() => props.page, (value) => value !== undefined && (innerPage.value = value))
watch(() => props.pageSize, (value) => value !== undefined && (innerPageSize.value = value))
watch(() => props.sort, (value) => (innerSort.value = value ?? null))
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
})

const rows = computed<T[]>(() => (isControlledData.value ? (props.data ?? []) : requestState.data.value))
const total = computed(() => props.total ?? requestState.total.value)
const loading = computed(() => props.loading ?? requestState.loading.value)

const selectionEnabled = computed(
  () => props.selection !== false && adapter.capabilities.dataGrid.selection,
)

const columns = computed<ProTableColumn<T>[]>(() =>
  props.columns
    .filter((column) => !column.hideInTable)
    .map((column) => resolveColumnRenderer(column, { Tag: adapter.primitives.Tag })),
)

const gridProps = computed(() => ({
  ...(props.uiProps?.grid ?? {}),
  columns: columns.value,
  data: rows.value,
  rowKey: props.rowKey,
  loading: loading.value,
  presentation: props.presentation === 'auto' ? adapter.capabilities.dataGrid.presentation : props.presentation,
  selectionEnabled: selectionEnabled.value,
  selectedKeys: innerSelected.value,
  sort: innerSort.value,
  emptyText: props.emptyText,
  rowClickable: true,
  loadMore: isInfinite.value && !isControlledData.value && props.pagination !== false,
  finished: requestState.finished.value,
}))

const showPagination = computed(
  () => props.pagination !== false && !isControlledData.value && !isInfinite.value,
)

const forwardedCellSlots = computed<string[]>(() =>
  columns.value.map((column) => column.key).filter((key) => Boolean(slots[`cell-${key}`])),
)

function onSelectedKeys(keys: Key[]) {
  innerSelected.value = keys
  emit('update:selectedKeys', keys)
}

function onSort(sort: SortState | null) {
  innerSort.value = sort
  emit('update:sort', sort)
  if (!isControlledData.value) {
    innerPage.value = 1
  }
}

function onPage(page: number) {
  innerPage.value = page
  emit('update:page', page)
}

function onPageSize(size: number) {
  innerPageSize.value = size
  emit('update:pageSize', size)
  innerPage.value = 1
}

async function reload(options: { resetPage?: boolean } = {}) {
  emit('refresh')
  if (isControlledData.value) return
  if (isInfinite.value) requestState.finished.value = false
  await requestState.reload(options)
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
  <div class="fbk-pro-table" :class="{ 'fbk-pro-table--cards': adapter.capabilities.dataGrid.presentation === 'cards' }">
    <!-- toolbar 默认 true 只表示「允许工具栏」。没有插槽时不该渲染容器 ——
         虽然 :empty 能兜住，但少一个空节点对可访问性和 DOM 快照都更干净。 -->
    <div v-if="$slots.toolbar" class="fbk-pro-table__toolbar" v-bind="uiProps?.toolbar">
      <slot name="toolbar" :selected-keys="innerSelected" :reload="reload" />
    </div>

    <component
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
    </component>

    <div v-if="showPagination" class="fbk-pro-table__pagination" v-bind="uiProps?.pagination">
      <component
        :is="Pagination"
        :page="innerPage"
        :page-size="innerPageSize"
        :total="total"
        :page-sizes="typeof pagination === 'object' ? pagination.pageSizes : undefined"
        :show-total="typeof pagination === 'object' ? pagination.showTotal : true"
        :show-jumper="typeof pagination === 'object' ? pagination.showJumper : true"
        @update:page="onPage"
        @update:page-size="onPageSize"
      />
    </div>
  </div>
</template>
