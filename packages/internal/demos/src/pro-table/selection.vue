<script setup lang="ts">
import { ref } from 'vue'
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn } from '@fbk/components/pro-table'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

/**
 * 多选 + 批量操作 + 行内操作栏。
 *
 * 三个要点：
 *   · 全选只作用于**当前页**——跨页全选需要后端配合，不做虚假承诺；
 *   · 行内 action 点击不会触发行点击（内部 stopPropagation）；
 *   · 操作超过 max 个自动折叠，不会把列宽撑爆。
 */
const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'customer', title: '客户', dataIndex: 'customer' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum },
  {
    key: 'op',
    title: '操作',
    valueType: 'actions',
    width: 160,
    max: 2,
    actions: [
      { key: 'view', text: '查看', variant: 'text', onClick: ({ row }) => (log.value = `查看 ${row.orderNo}`) },
      {
        key: 'edit',
        text: '编辑',
        // 已取消的订单不允许编辑
        disabled: ({ row }) => row.status === 2,
        onClick: ({ row }) => (log.value = `编辑 ${row.orderNo}`),
      },
      {
        key: 'copy',
        text: '复制单号',
        visible: ({ row }) => Boolean(row.orderNo),
        onClick: ({ row }) => (log.value = `复制 ${row.orderNo}`),
      },
      {
        key: 'delete',
        text: '删除',
        status: 'danger',
        confirm: '确定删除这条订单？',
        onClick: ({ row }) => (log.value = `删除 ${row.orderNo}`),
      },
    ],
  },
]

const selectedKeys = ref<Array<string | number>>([])
const log = ref('')
const tableRef = ref<any>()

function batchDelete() {
  log.value = `批量删除 ${selectedKeys.value.length} 条：${selectedKeys.value.join(', ')}`
  tableRef.value?.clearSelection()
}
</script>

<template>
  <div>
    <p>
      已选 <strong>{{ selectedKeys.length }}</strong> 项
      <span v-if="log"> · {{ log }}</span>
    </p>

    <FbkProTable
      ref="tableRef"
      v-model:selected-keys="selectedKeys"
      :columns="columns"
      :request="queryOrders"
      row-key="id"
      :selection="{ preserveOnReload: true }"
    >
      <template #bulk-actions="{ clear }">
        <button
          type="button"
          class="fbk-demo-btn"
          :disabled="!selectedKeys.length"
          @click="batchDelete"
        >
          批量删除
        </button>
        <button type="button" class="fbk-demo-btn" :disabled="!selectedKeys.length" @click="clear">
          清空
        </button>
      </template>
    </FbkProTable>
  </div>
</template>
