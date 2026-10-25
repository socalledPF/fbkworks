<script setup lang="ts">
import { FbkDetailPage } from '@fbk/components/detail-page'
import type { DescriptionItem } from '@fbk/components/descriptions'

/**
 * DetailPage：详情页的约定。
 *
 * 要看的点：
 *   · 加载 / 错误 / 404 三态由组件负责，与 CrudPage 表现一致
 *   · `request` 返回 null 时渲染 404，**不是「加载失败」**
 *   · extra 插槽放业务特有区块（这里是时间线）
 */
interface Order {
  orderNo: string
  customer: string
  amount: number
  status: string
  createdAt: string
  address: string
}

const items: DescriptionItem<Order>[] = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'customer', label: '客户', dataIndex: 'customer' },
  { key: 'amount', label: '金额', getValue: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'status', label: '状态', dataIndex: 'status' },
  { key: 'createdAt', label: '下单时间', dataIndex: 'createdAt' },
  { key: 'address', label: '收货地址', dataIndex: 'address', span: 2 },
]

/** 模拟详情接口。返回 null 表示资源不存在 */
async function fetchOrder(): Promise<Order | null> {
  await new Promise((r) => setTimeout(r, 400))
  return {
    orderNo: 'SO2026000001',
    customer: '张三',
    amount: 1280.5,
    status: '已发货',
    createdAt: '2026-10-25 10:32',
    address: '上海市浦东新区世纪大道 100 号',
  }
}

const timeline = [
  { time: '10:32', text: '订单创建', active: true },
  { time: '10:35', text: '买家付款', active: true },
  { time: '14:20', text: '仓库发货', active: true },
  { time: '—', text: '买家确认收货', active: false },
]
</script>

<template>
  <FbkDetailPage
    :request="fetchOrder"
    :items="items"
    :title="(data: Order) => `订单 ${data.orderNo}`"
    subtitle="对比手写详情页：三态、面包屑、返回都不需要自己写"
    :breadcrumbs="[{ text: '订单列表' }, { text: '详情' }]"
    back
  >
    <template #extra>
      <div class="demo-extra">
        <h3 class="demo-extra__title">订单流转</h3>
        <ol class="demo-extra__timeline">
          <li
            v-for="(t, i) in timeline"
            :key="i"
            class="demo-extra__item"
            :class="{ 'is-active': t.active }"
          >
            <span class="demo-extra__dot" />
            <span class="demo-extra__text">{{ t.text }}</span>
            <span class="demo-extra__time">{{ t.time }}</span>
          </li>
        </ol>
      </div>
    </template>

    <template #actions>
      <button type="button" class="fbk-demo-btn">编辑</button>
      <button type="button" class="fbk-demo-btn fbk-demo-btn--primary">确认收货</button>
    </template>
  </FbkDetailPage>
</template>

<style scoped>
.demo-extra {
  padding: var(--fbk-spacing-lg);
  background: var(--fbk-color-bg-container);
  border: 1px solid var(--fbk-color-border-light);
  border-radius: var(--fbk-radius-lg);
}

.demo-extra__title {
  margin: 0 0 var(--fbk-spacing-md);
  font-size: var(--fbk-font-size-lg);
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-text);
}

.demo-extra__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-sm);
  padding: 0;
  margin: 0;
  list-style: none;
}

.demo-extra__item {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: var(--fbk-spacing-sm);
  align-items: center;
  font-size: var(--fbk-font-size-sm);
}

.demo-extra__dot {
  width: 8px;
  height: 8px;
  background: var(--fbk-color-border);
  border-radius: var(--fbk-radius-round);
}

.demo-extra__item.is-active .demo-extra__dot {
  background: var(--fbk-color-primary);
}

.demo-extra__text {
  color: var(--fbk-color-text);
}

.demo-extra__time {
  color: var(--fbk-color-text-tertiary);
}
</style>
