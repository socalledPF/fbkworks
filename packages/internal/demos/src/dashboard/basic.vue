<script setup lang="ts">
import { ref } from 'vue'
import {
  FbkStatCard,
  FbkStatGroup,
  FbkTrendChart,
  FbkBarChart,
  FbkPieChart,
  FbkRankList,
  FbkChartCard,
} from '@fbk/dashboard'

/**
 * 数据看板：嵌入后台页面的统计模块。
 *
 * 视觉基调是白底卡片 + 细边框 + 与 ProTable 同一套语言，
 * 刻意不使用大屏的暗底与发光 —— 那是另一种媒介。
 */
const range = ref<'7d' | '30d'>('7d')

const stats = [
  {
    title: '总销售额',
    value: 1284500,
    prefix: '¥',
    change: 12.5,
    changeLabel: '较上月',
    trend: [12, 18, 15, 22, 28, 26, 34],
  },
  {
    title: '订单数',
    value: 8642,
    change: 8.2,
    changeLabel: '较上月',
    trend: [8, 12, 10, 14, 18, 16, 21],
  },
  {
    title: '客单价',
    value: 148.6,
    precision: 2,
    prefix: '¥',
    change: -2.1,
    changeLabel: '较上月',
    trend: [18, 16, 17, 15, 14, 15, 13],
  },
  {
    title: '退款率',
    value: 1.8,
    precision: 1,
    suffix: '%',
    change: 0.4,
    changeLabel: '较上月',
    // 退款率上涨是坏事，所以显式指定语义，不能靠 auto 猜
    changeTone: 'negative' as const,
    trend: [10, 12, 11, 14, 13, 16, 18],
  },
]

const trendData = {
  '7d': {
    categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    series: [
      { name: '销售额', data: [820, 932, 901, 934, 1290, 1330, 1320] },
      { name: '订单数', data: [620, 732, 701, 734, 1090, 1130, 1120] },
    ],
  },
  '30d': {
    categories: ['第1周', '第2周', '第3周', '第4周'],
    series: [
      { name: '销售额', data: [5820, 6932, 7901, 8934] },
      { name: '订单数', data: [3620, 4732, 5701, 6734] },
    ],
  },
}

const channel = [
  { name: '直营', value: 4820 },
  { name: '分销', value: 3610 },
  { name: '电商', value: 2470 },
  { name: '门店', value: 1980 },
]

const regions = [
  { name: '华东', value: 48.2 },
  { name: '华南', value: 36.1 },
  { name: '华北', value: 24.7 },
  { name: '西南', value: 19.8 },
  { name: '华中', value: 16.2 },
]
</script>

<template>
  <div class="dashboard-demo">
    <FbkStatGroup :columns="{ xs: 1, sm: 2, lg: 4 }">
      <FbkStatCard v-for="s in stats" :key="s.title" v-bind="s" />
    </FbkStatGroup>

    <div class="dashboard-demo__row">
      <FbkTrendChart
        title="销售趋势"
        :categories="trendData[range].categories"
        :series="trendData[range].series"
        height="300px"
      >
        <template #extra>
          <div class="dashboard-demo__switch">
            <button
              type="button"
              class="fbk-demo-btn"
              :class="{ 'fbk-demo-btn--active': range === '7d' }"
              @click="range = '7d'"
            >
              近 7 天
            </button>
            <button
              type="button"
              class="fbk-demo-btn"
              :class="{ 'fbk-demo-btn--active': range === '30d' }"
              @click="range = '30d'"
            >
              近 30 天
            </button>
          </div>
        </template>
      </FbkTrendChart>

      <FbkPieChart
        title="渠道占比"
        :data="channel"
        :center-value="12880"
        center-label="总订单"
        height="300px"
      />
    </div>

    <div class="dashboard-demo__row">
      <FbkBarChart
        title="区域销售"
        :categories="regions.map((r) => r.name)"
        :series="[{ name: '销售额', data: regions.map((r) => r.value) }]"
        height="280px"
      />

      <FbkChartCard title="区域排名">
        <FbkRankList :data="regions" :formatter="(v: number) => `${v.toFixed(1)}%`" />
      </FbkChartCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard-demo {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
}

.dashboard-demo__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--fbk-spacing-lg);
}

@media (min-width: 1024px) {
  .dashboard-demo__row {
    grid-template-columns: 2fr 1fr;
  }
}

.dashboard-demo__switch {
  display: flex;
  gap: var(--fbk-spacing-xs);
}
</style>
