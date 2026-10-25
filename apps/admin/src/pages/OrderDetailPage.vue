<script setup lang="ts">
import { FbkDetailPage } from '@fbk/components/detail-page'
import type { DescriptionItem } from '@fbk/components/descriptions'
import { fetchOrder, ORDER_STATUS_MAP, type OrderRow } from '../mock/data'
import { navigate, params } from '../router'

/**
 * 订单详情。
 *
 * **这是 DetailPage 的用法演示。** 对比改造前（198 行、手写三态）：
 *   · 加载态 / 错误态 / 404 由组件负责，与列表页表现一致
 *   · 错误自动走 useReporter()，不再是一个监控黑洞
 *   · 页面只剩「字段怎么描述」这一件事
 *
 * 时间线不是通用能力，放在 extra 插槽里 —— 组件不该知道业务特有的区块。
 */
const id = Number(params.value[0])

const items: DescriptionItem<OrderRow>[] = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'customer', label: '客户', dataIndex: 'customer' },
  { key: 'phone', label: '手机号', dataIndex: 'phone' },
  { key: 'channel', label: '渠道', dataIndex: 'channel' },
  {
    key: 'amount',
    label: '订单金额',
    getValue: (row) => `¥${row.amount.toFixed(2)}`,
  },
  {
    key: 'status',
    label: '订单状态',
    getValue: (row) => ORDER_STATUS_MAP[row.status].text,
  },
  { key: 'itemCount', label: '商品件数', dataIndex: 'itemCount' },
  {
    key: 'createdAt',
    label: '下单时间',
    getValue: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    key: 'paidAt',
    label: '支付时间',
    getValue: (row) => (row.paidAt ? new Date(row.paidAt).toLocaleString('zh-CN') : '未支付'),
  },
  { key: 'address', label: '收货地址', dataIndex: 'address', span: 2 },
  {
    key: 'remark',
    label: '备注',
    getValue: (row) => row.remark || '—',
    span: 2,
  },
]

/** 订单流转。真实项目里这来自独立接口，这里用固定数据演示插槽用法 */
const timeline = [
  { time: '2026-09-15 10:32', text: '订单创建', active: true },
  { time: '2026-09-15 10:35', text: '买家付款', active: true },
  { time: '2026-09-15 14:20', text: '仓库发货', active: true },
  { time: '2026-09-18 09:10', text: '买家确认收货', active: false },
]
</script>

<template>
  <FbkDetailPage
    :request="() => fetchOrder(id)"
    :items="items"
    :title="(data: OrderRow) => `订单 ${data.orderNo}`"
    :breadcrumbs="[
      { text: '交易管理' },
      { text: '订单列表', to: '/orders' },
      { text: '订单详情' },
    ]"
    back
    bordered
    @back="navigate('/orders')"
  >
    <!-- 时间线：业务特有区块，不属于通用能力 -->
    <template #extra>
      <section class="detail__card">
        <h2 class="detail__title">订单流转</h2>
        <ol class="detail__timeline">
          <li
            v-for="(t, i) in timeline"
            :key="i"
            class="detail__timeline-item"
            :class="{ 'is-active': t.active }"
          >
            <span class="detail__timeline-dot" />
            <div class="detail__timeline-body">
              <span class="detail__timeline-text">{{ t.text }}</span>
              <span class="detail__timeline-time">{{ t.time }}</span>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </FbkDetailPage>
</template>

<style scoped>
.detail__card {
  padding: var(--fbk-spacing-lg);
  background: var(--fbk-color-bg-container);
  border: 1px solid var(--fbk-color-border-light);
  border-radius: var(--fbk-radius-lg);
}

.detail__title {
  margin: 0 0 var(--fbk-spacing-md);
  font-size: var(--fbk-font-size-lg);
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-text);
}

.detail__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-md);
  padding: 0;
  margin: 0;
  list-style: none;
}

.detail__timeline-item {
  display: flex;
  gap: var(--fbk-spacing-md);
  align-items: flex-start;
}

.detail__timeline-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  background: var(--fbk-color-border);
  border-radius: var(--fbk-radius-round);
}

.detail__timeline-item.is-active .detail__timeline-dot {
  background: var(--fbk-color-primary);
  box-shadow: 0 0 0 3px var(--fbk-color-primary-bg);
}

.detail__timeline-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail__timeline-text {
  font-size: var(--fbk-font-size-md);
  color: var(--fbk-color-text);
}

.detail__timeline-time {
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-tertiary);
}
</style>
