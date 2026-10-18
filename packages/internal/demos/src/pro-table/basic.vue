<script setup lang="ts">
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn } from '@fbk/components/pro-table'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', width: 160, copyable: true, mobile: { primary: true } },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 120 },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right', width: 120 },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum, width: 100 },
  { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', valueType: 'datetime', width: 180, mobile: { hidden: true } },
]

const request = (params: any) => queryOrders(params)
</script>

<template>
  <FbkProTable :columns="columns" :request="request" row-key="id" />
</template>
