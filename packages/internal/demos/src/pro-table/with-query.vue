<script setup lang="ts">
import { ref } from 'vue'
import { FbkProTable } from '@fbkworks/components/pro-table'
import type { ProTableColumn } from '@fbkworks/components/pro-table'
import { FbkQueryForm } from '@fbkworks/components/query-form'
import type { QueryField } from '@fbkworks/components/query-form'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

/**
 * 查询表单 + 表格的联动。
 *
 * 这是业务里最常见的组合，也是 ProTable 的 `params` 与 QueryForm 的
 * `submit` 唯一该有的连接方式：查询表单负责收集条件，
 * 提交时把条件交给表格的 params，表格自己重新请求第一页。
 *
 * 几个容易踩的点：
 *   · 不能在 @change 上联动 —— 用户每敲一个字就发一次请求。
 *     只在 @submit 和 @reset 上触发。
 *   · params 变化时 useTableRequest 会重置到第一页，
 *     所以点「查询」后不需要手动把 page 设回 1。
 *   · 重置要连表格一起重置，否则表单空了但表格还筛着旧条件。
 */
const fields: QueryField[] = [
  { name: 'keyword', label: '关键词', type: 'input', placeholder: '订单号 / 客户' },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待支付', value: 0 },
      { label: '已完成', value: 1 },
      { label: '已取消', value: 2 },
    ],
  },
  { name: 'owner', label: '负责人', type: 'input' },
]

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', width: 160, copyable: true, mobile: { primary: true } },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 120 },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right', width: 120 },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum, width: 100 },
  { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', valueType: 'datetime', width: 180, mobile: { hidden: true } },
]

const tableRef = ref<any>()
const queryParams = ref<Record<string, any>>({})
const submitted = ref('')

/** 只有提交才更新 params —— 输入过程中不触发请求 */
function onSubmit(values: Record<string, any>) {
  queryParams.value = { ...values }
  submitted.value = JSON.stringify(values)
}

function onReset(values: Record<string, any>) {
  queryParams.value = { ...values }
  submitted.value = '（已重置）'
}

const request = (params: any) => queryOrders(params)

const stackStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--fbk-spacing-lg)',
} as const

const hintStyle = {
  marginRight: 'auto',
  fontSize: 'var(--fbk-font-size-sm)',
  color: 'var(--fbk-color-text-secondary)',
} as const
</script>

<template>
  <div :style="stackStyle">
    <FbkQueryForm
      :fields="fields"
      :columns="{ xs: 1, md: 3 }"
      :visible-count="3"
      @submit="onSubmit"
      @reset="onReset"
    />

    <FbkProTable
      ref="tableRef"
      :columns="columns"
      :request="request"
      :params="queryParams"
      row-key="id"
      :pagination="{ showTotal: true, showJumper: true }"
    >
      <template #toolbar>
        <span :style="hintStyle">
          当前条件：<code>{{ submitted || '（全部）' }}</code>
        </span>
      </template>
    </FbkProTable>
  </div>
</template>
