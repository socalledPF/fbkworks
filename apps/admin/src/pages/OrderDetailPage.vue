<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FbkPageContainer } from '@fbk/components/page-container'
import { FbkDescriptions } from '@fbk/components/descriptions'
import type { DescriptionItem } from '@fbk/components/descriptions'
import { FbkResult } from '@fbk/components/result'
import { fetchOrder, ORDER_STATUS_MAP, type OrderRow } from '../mock/data'
import { navigate, params } from '../router'

/**
 * 订单详情。
 *
 * 检验点：
 *   · PageContainer 的返回按钮 + 面包屑
 *   · Descriptions 的分组与自定义渲染
 *   · 数据不存在时用 Result 的 404
 */
const loading = ref(true)
const order = ref<OrderRow | null>(null)

const id = Number(params.value[0])

onMounted(async () => {
  loading.value = true
  try {
    order.value = await fetchOrder(id)
  } finally {
    loading.value = false
  }
})

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

const timeline = [
  { time: '2026-09-15 10:32', text: '订单创建', active: true },
  { time: '2026-09-15 10:35', text: '买家付款', active: true },
  { time: '2026-09-15 14:20', text: '仓库发货', active: true },
  { time: '2026-09-18 09:10', text: '买家确认收货', active: false },
]
</script>

<template>
  <FbkPageContainer
    :title="order ? `订单 ${order.orderNo}` : '订单详情'"
    back
    :breadcrumbs="[{ text: '交易管理' }, { text: '订单列表', to: '/orders' }, { text: '订单详情' }]"
    @back="navigate('/orders')"
  >
    <div v-if="loading" class="detail__loading">加载中…</div>

    <FbkResult
      v-else-if="!order"
      status="404"
      title="订单不存在"
      :subtitle="`没有找到 ID 为 ${id} 的订单`"
    >
      <template #default>
        <button type="button" class="admin-btn admin-btn--primary" @click="navigate('/orders')">
          返回列表
        </button>
      </template>
    </FbkResult>

    <div v-else class="detail">
      <section class="detail__card">
        <h2 class="detail__title">基本信息</h2>
        <FbkDescriptions :items="items" :data="order" :column="2" />
      </section>

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
    </div>
  </FbkPageContainer>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
}

.detail__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-tertiary);
}

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
