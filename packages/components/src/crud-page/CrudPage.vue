<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, useSlots } from 'vue'
import type { Key } from '@fbk/shared'
import { FbkQueryForm } from '../query-form'
import type { QueryFormExpose } from '../query-form'
import { FbkProTable } from '../pro-table'
import type { ProTableExpose } from '../pro-table'
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

const slots = useSlots()

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

async function refresh() {
  await tableRef.value?.reload()
}

async function reset() {
  // 先重置表单（会触发 reset 事件把 params 同步成默认值），再刷新表格
  queryRef.value?.reset()
  await refresh()
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
const passedSlots = computed(() =>
  Object.keys(slots ?? {}).filter(
    (name) => name === 'toolbar' || name === 'bulk-actions' || name === 'card-footer' || name.startsWith('cell-'),
  ),
)

const queryProps = computed(() => ({
  ...(props.queryProps ?? {}),
  fields: props.queryFields,
  defaultCollapsed: props.defaultCollapsed,
}))
</script>

<template>
  <div class="fbk-crud-page">
    <FbkQueryForm
      v-if="hasQuery"
      ref="queryRef"
      v-bind="queryProps"
      @submit="onSubmit"
      @reset="onReset"
    />

    <FbkProTable ref="tableRef" v-bind="tableProps" v-model:selected-keys="selectedKeys">
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
