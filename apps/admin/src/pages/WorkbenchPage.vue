<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FbkPageContainer } from '@fbk/components/page-container'
import {
  FbkStatCard,
  FbkStatGroup,
  FbkTrendChart,
  FbkPieChart,
  FbkRankList,
  FbkChartCard,
} from '@fbk/dashboard'
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn } from '@fbk/components/pro-table'
import type { Status } from '@fbk/adapter-core'
import { FbkResult } from '@fbk/components/result'
import { fetchDashboard, ORDER_STATUS_MAP, type DashboardStats, type OrderRow } from '../mock/data'
import { navigate } from '../router'

/**
 * 工作台。
 *
 * 这是对 @fbk/dashboard 的真实检验：指标卡 + 趋势 + 环形 + 排行榜
 * 组合在一个页面里，能否在真实布局约束下正常工作。
 */
const loading = ref(true)
const error = ref('')
const stats = ref<DashboardStats | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await fetchDashboard()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 骨架屏：与真实卡片同结构，避免加载完成时布局跳动 */
const skeletonCards = Array.from({ length: 4 }, () => ({
  title: '加载中',
  value: '—' as const,
}))

const statCards = computed(() => {
  if (!stats.value) return []
  return [
    {
      title: '总销售额',
      value: stats.value.totalSales,
      prefix: '¥',
      change: 12.5,
      changeLabel: '较上周期',
      trend: [42, 48, 45, 58, 62, 55, 71],
    },
    {
      title: '订单总数',
      value: stats.value.orderCount,
      change: 8.2,
      changeLabel: '较上周期',
      trend: [28, 32, 30, 38, 42, 40, 48],
    },
    {
      title: '客单价',
      value: Math.round(stats.value.avgOrderValue),
      prefix: '¥',
      change: -2.1,
      changeLabel: '较上周期',
      trend: [18, 17, 17, 16, 15, 15, 14],
    },
    {
      title: '退款率',
      value: stats.value.refundRate,
      precision: 1,
      suffix: '%',
      change: 0.4,
      changeLabel: '较上周期',
      // 退款率上涨是坏事 —— 显式指定语义
      changeTone: 'negative' as const,
      trend: [8, 9, 9, 11, 10, 12, 13],
    },
  ]
})

/** 最近订单的简表 */
const recentColumns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', width: 150 },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 90 },
  {
    key: 'amount',
    title: '金额',
    dataIndex: 'amount',
    valueType: 'money',
    width: 110,
    align: 'right',
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    valueType: 'enum',
    width: 100,
    valueEnum: Object.fromEntries(
      Object.entries(ORDER_STATUS_MAP).map(([k, v]) => [k, { text: v.text, status: v.status as Status }]),
    ),
  },
]
</script>

<template>
  <FbkPageContainer title="工作台" subtitle="今天是 2026-10-22，欢迎回来">
    <template #extra>
      <button type="button" class="admin-btn" @click="load">刷新数据</button>
    </template>

    <!-- 加载失败：用组件库的 Result -->
    <FbkResult
      v-if="error"
      status="error"
      title="数据加载失败"
      :subtitle="error"
    >
      <template #default>
        <button type="button" class="admin-btn admin-btn--primary" @click="load">重试</button>
      </template>
    </FbkResult>

    <div v-else class="workbench">
      <!-- 指标卡：骨架屏用同一套卡片壳，避免布局跳动 -->
      <FbkStatGroup :columns="{ xs: 1, sm: 2, lg: 4 }">
        <FbkStatCard
          v-for="(card, i) in loading ? skeletonCards : statCards"
          :key="i"
          v-bind="card"
          :loading="loading"
        />
      </FbkStatGroup>

      <div class="workbench__row">
        <FbkTrendChart
          v-if="stats"
          title="销售趋势"
          :categories="stats.salesTrend.categories"
          :series="stats.salesTrend.series"
          height="300px"
          :loading="loading"
        />
        <FbkChartCard v-else title="销售趋势">
          <div class="workbench__placeholder">加载中…</div>
        </FbkChartCard>

        <FbkPieChart
          v-if="stats"
          title="渠道占比"
          :data="stats.channelShare"
          :center-value="stats.orderCount"
          center-label="总订单"
          height="300px"
          :loading="loading"
        />
        <FbkChartCard v-else title="渠道占比">
          <div class="workbench__placeholder">加载中…</div>
        </FbkChartCard>
      </div>

      <div class="workbench__row">
        <FbkChartCard title="最近订单">
          <template #extra>
            <button type="button" class="admin-btn admin-btn--link" @click="navigate('/orders')">
              查看全部 →
            </button>
          </template>
          <FbkProTable
            :columns="recentColumns"
            :data="stats?.recentOrders ?? []"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="small"
          />
        </FbkChartCard>

        <FbkChartCard title="区域排名">
          <FbkRankList
            v-if="stats"
            :data="stats.regionRank"
            :formatter="(v: number) => `${v.toFixed(1)}万`"
          />
          <div v-else class="workbench__placeholder">加载中…</div>
        </FbkChartCard>
      </div>
    </div>
  </FbkPageContainer>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
}

.workbench__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--fbk-spacing-lg);
}

@media (min-width: 1100px) {
  .workbench__row {
    grid-template-columns: 2fr 1fr;
  }
}

.workbench__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-tertiary);
}
</style>
