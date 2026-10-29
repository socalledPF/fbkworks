<script setup lang="ts">
import { FbkPageContainer } from '@fbkworks/components/page-container'
import { FbkDescriptions } from '@fbkworks/components/descriptions'
import { useAdapter } from '@fbkworks/adapter-core'

const adapter = useAdapter()
const { Button } = adapter.primitives

const order = {
  orderNo: 'SO20260001',
  customer: '张三',
  amount: 1234.5,
  createdAt: '2026-09-01 10:30',
}

const items = [
  { key: 'orderNo', label: '订单号' },
  { key: 'customer', label: '客户' },
  { key: 'amount', label: '金额', getValue: (row: any) => `¥${row.amount}` },
  { key: 'createdAt', label: '创建时间' },
]
</script>

<template>
  <FbkPageContainer
    title="订单详情"
    subtitle="只读视图"
    :breadcrumbs="[{ text: '首页', to: '/' }, { text: '订单管理', to: '/orders' }, { text: 'SO20260001' }]"
    :back="true"
    max-width="960px"
  >
    <!-- 用适配器的 Button，不用原生 <button>：原生按钮在三个 UI 库下
         高度、圆角、字号全都不一样，demo 会误导使用者。 -->
    <template #extra>
      <component :is="Button">导出</component>
      <component :is="Button" variant="primary">编辑</component>
    </template>

    <FbkDescriptions :data="order" bordered :items="items" />
  </FbkPageContainer>
</template>
