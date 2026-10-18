<script setup lang="ts">
import { ref } from 'vue'
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn } from '@fbk/components/pro-table'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'customer', title: '客户', dataIndex: 'customer' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum },
]

const selectedKeys = ref<Array<string | number>>([])
</script>

<template>
  <div>
    <p>已选 {{ selectedKeys.length }} 项</p>
    <FbkProTable
      v-model:selected-keys="selectedKeys"
      :columns="columns"
      :request="queryOrders"
      row-key="id"
      :selection="{ preserveOnReload: true }"
    />
  </div>
</template>
