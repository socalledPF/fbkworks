<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, nextTick, ref, useAttrs, useSlots } from 'vue'
import type { SortState } from '@fbkworks/adapter-core'
import type { Key } from '@fbkworks/shared'
import { FbkQueryForm } from '../query-form'
import type { QueryFormExpose } from '../query-form'
import { FbkProTable } from '../pro-table'
import type { ProTableExpose } from '../pro-table'
import type { TableResponse } from '../pro-table'
// 直接取具名类型而不是经 PageQuery 别名：defineEmits 里的别名
// 会被 dts 生成器内联，产物中出现 import('packages/data/dist') 这类坏路径。
import type { PageQuery } from '@fbkworks/data'
import type { CrudPageExpose, CrudPageProps } from './types'

/**
 * 查询表单 + 表格的联动固化。
 *
 * 三条容易漏的细节，这里都处理了：
 *   1. 只在 submit / reset 时更新 params —— 不能在 @change 上联动，
 *      否则用户每敲一个字就发一次请求
 *   2. 重置要连表格一起重置 —— 否则表单空了但表格还筛着旧条件
 *   3. params 变化会自动回到第一页 —— 由 useTableRequest 保证，不需要手动设
 */
defineOptions({ name: 'FbkCrudPage', inheritAttrs: false })

const props = withDefaults(defineProps<CrudPageProps<T>>(), {
  queryFields: () => [],
  queryProps: undefined,
  rowKey: 'id',
  tableProps: undefined,
  immediate: true,
  defaultCollapsed: true,
})

const attrs = useAttrs()

/* 表格事件必须显式声明并转发。
   不声明时 onError 会留在 attrs 里，被根元素的 v-bind="attrs" 挂成**原生**
   error 监听器 —— 表格请求失败时父组件一次也收不到，且没有任何报错。
   声明之后 onError 被 emits 拦截，所以下面每一条都要真的转发出去。 */
const emit = defineEmits<{
  /** 表格请求成功 */
  load: [result: TableResponse<T>, params: PageQuery]
  /** 表格请求失败 */
  error: [error: unknown, params: PageQuery]
  /** 表格开始重新查询 */
  refresh: []
  'row-click': [row: T, index: number, event: Event]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'update:sort': [sort: SortState | null]
}>()

/* 显式标注 Slot 的键类型。
   不标注时，generic 组件里的 useSlots() 在 dts 构建阶段无法收敛，
   会报 TS7022（隐式 any）—— 这个错误只在 build 时出现，typecheck 看不到。 */
const slots: Record<string, unknown> = useSlots() as Record<string, unknown>

const queryRef = ref<QueryFormExpose>()
const tableRef = ref<ProTableExpose<T>>()

const params = ref<Record<string, any>>({})

const hasQuery = computed(() => (props.queryFields?.length ?? 0) > 0)

function onSubmit(values: Record<string, any>) {
  // 浅拷贝：避免业务侧后续修改表单对象时悄悄改到已生效的条件
  params.value = { ...values }
}

function onReset(values: Record<string, any>) {
  params.value = { ...values }
}

function onLoad(result: TableResponse<T>, requestParams: PageQuery) {
  emit('load', result, requestParams)
}

function onError(error: unknown, requestParams: PageQuery) {
  emit('error', error, requestParams)
}

function onRowClick(row: T, index: number, event: Event) {
  emit('row-click', row, index, event)
}

async function refresh() {
  await tableRef.value?.reload()
}

async function reset() {
  /* 只重置表单就够了：reset 事件同步把 params 换成默认值，
     useTableRequest 的 watch 负责回到第 1 页并重新查询。
     再补一次 refresh() 只是多打一发，两个响应必被 requestId 丢掉一个。
     没有查询区时 params 不会变、watch 不触发，才需要自己刷。 */
  if (!queryRef.value) {
    await refresh()
    return
  }
  queryRef.value.reset()
  // 等 watch 把那一次查询派发出去，reset() 返回时请求已经在路上
  await nextTick()
}

defineExpose<CrudPageExpose<T>>({
  refresh,
  reset,
  getParams: () => ({ ...params.value }),
  getData: () => tableRef.value?.getData() ?? [],
  getSelectedKeys: () => selectedKeys.value,
  clearSelection: () => tableRef.value?.clearSelection(),
})

const selectedKeys = ref<Key[]>([])

const tableProps = computed(() => ({
  ...(props.tableProps ?? {}),
  columns: props.columns,
  request: props.request,
  params: params.value,
  rowKey: props.rowKey,
  // 不传时保持 ProTable 的默认（开启多选）；显式 false 才关闭
  ...(props.selection === undefined ? {} : { selection: props.selection }),
}))

/**
 * 要转发给 ProTable 的插槽名。
 *
 * 只转发「用户真的传了」的那些：ProTable 内部用 `$slots.toolbar` 判断
 * 是否渲染工具栏容器，如果无条件声明插槽，就会渲染出一个空的工具栏。
 */
const passedSlots = computed((): string[] =>
  Object.keys(slots ?? {}).filter(
    (name) =>
      name === 'toolbar' ||
      name === 'bulk-actions' ||
      name === 'card-footer' ||
      name === 'error' ||
      // 新增插槽必须同步加进白名单：白名单是显式的，漏了就是「传了没效果，还不报错」
      name === 'empty' ||
      name.startsWith('cell-'),
  ),
)

const queryProps = computed(() => ({
  ...(props.queryProps ?? {}),
  fields: props.queryFields,
  defaultCollapsed: props.defaultCollapsed,
}))
</script>

<template>
  <div class="fbk-crud-page" v-bind="attrs">
    <FbkQueryForm
      v-if="hasQuery"
      ref="queryRef"
      v-bind="queryProps"
      @submit="onSubmit"
      @reset="onReset"
    />

    <FbkProTable
      ref="tableRef"
      v-bind="tableProps"
      v-model:selected-keys="selectedKeys"
      @load="onLoad"
      @error="onError"
      @refresh="emit('refresh')"
      @row-click="onRowClick"
      @update:page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
      @update:sort="emit('update:sort', $event)"
    >
      <!--
        插槽声明用 v-for + 名字数组，而不是 `<template v-if #name>`。
        后者不会被 Vue 编译成具名插槽（实测 toolbar 与 bulk-actions 静默丢失）。
        v-for 里只遍历「用户真的传了」的名字，于是没传时 ProTable 的
        $slots.toolbar 判断仍然为假，不会渲染空容器。
      -->
      <template v-for="name in passedSlots" #[name]="slotProps" :key="name">
        <slot :name="name" v-bind="slotProps" :params="params" :selected-keys="selectedKeys" />
      </template>

    </FbkProTable>

    <slot name="form" />
  </div>
</template>
