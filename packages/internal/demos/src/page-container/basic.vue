<script setup lang="ts">
import { FbkPageContainer } from '@fbk/components/page-container'
import { FbkDescriptions } from '@fbk/components/descriptions'

const order = {
  orderNo: 'SO20260001',
  customer: '张三',
  amount: 1234.5,
  createdAt: '2026-09-01 10:30',
}
</script>

<template>
  <FbkPageContainer
    title="订单详情"
    subtitle="只读视图"
    :breadcrumbs="[{ text: '首页', to: '/' }, { text: '订单管理', to: '/orders' }, { text: 'SO20260001' }]"
    :back="true"
    max-width="960px"
  >
    <template #extra>
      <button type="button">导出</button>
      <button type="button">编辑</button>
    </template>

    <FbkDescriptions
      :data="order"
      bordered
      :items="[
        { key: 'orderNo', label: '订单号' },
        { key: 'customer', label: '客户' },
        { key: 'amount', label: '金额', getValue: (row: any) => `¥${row.amount}` },
        { key: 'createdAt', label: '创建时间' },
      ]"
    />
  </FbkPageContainer>
</template>
