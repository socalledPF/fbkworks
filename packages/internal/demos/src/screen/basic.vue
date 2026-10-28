<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  FbkScreenPage,
  FbkScreenHeader,
  FbkScreenPanel,
  FbkScreenGrid,
  FbkScreenNumber,
  FbkScreenScrollList,
  FbkScreenLineChart,
  FbkScreenBarChart,
  FbkScreenPieChart,
  FbkScreenGaugeChart,
} from '@fbk/screen'
import { alerts, channelShare, hourlyTrend, regionSales, topProducts } from './data'

/**
 * 完整大屏示例：8 个面板，覆盖 4 类图表 + 2 类布局组件。
 *
 * 布局用 24 列栅格：
 *   上排：左侧 6 列（指标+环形图）/ 中间 12 列（主趋势）/ 右侧 6 列（排行榜+告警）
 *   下排：三个 8 列（柱状 / 仪表盘 / 数字指标）
 */
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 模拟实时数据：每 3 秒刷新一次，验证 ScreenNumber 的滚动动画
  timer = setInterval(() => (now.value = new Date()), 3000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const totalVisits = ref(24680)
onMounted(() => {
  const t = setInterval(() => {
    totalVisits.value += Math.floor(Math.random() * 40) - 10
  }, 3000)
  onBeforeUnmount(() => clearInterval(t))
})

const stats = [
  { label: '今日访问', value: 24680, suffix: '', status: 'info' },
  { label: '订单总数', value: 8642, suffix: '', status: 'success' },
  { label: '销售额', value: 4820000, prefix: '¥', status: 'warning' },
  { label: '转化率', value: 3.82, precision: 2, suffix: '%', status: 'info' },
]
</script>

<template>
  <FbkScreenPage>
    <FbkScreenHeader title="运营数据监控中心" />

    <!-- 主区域：三列布局 -->
    <FbkScreenGrid :columns="24" gap="md" class="screen-main">
      <!-- 左列 6 -->
      <div class="screen-col" style="grid-column: span 6">
        <FbkScreenPanel title="核心指标" style="flex: 0 0 180px">
          <div class="screen-stats">
            <div v-for="s in stats" :key="s.label" class="screen-stats__item">
              <span class="screen-stats__label">{{ s.label }}</span>
              <FbkScreenNumber
                :value="s.value"
                :prefix="s.prefix"
                :suffix="s.suffix"
                :precision="s.precision ?? 0"
                size="sm"
              />
            </div>
          </div>
        </FbkScreenPanel>

        <FbkScreenPanel title="渠道占比" style="flex: 1 1 0; min-height: 0">
          <FbkScreenPieChart
            :data="channelShare"
            :center-value="12480"
            center-label="总订单"
          />
        </FbkScreenPanel>
      </div>

      <!-- 中列 12 -->
      <div class="screen-col" style="grid-column: span 12">
        <FbkScreenPanel title="实时流量趋势" style="flex: 1 1 0; min-height: 0">
          <template #extra>近 24 小时</template>
          <FbkScreenLineChart
            :categories="hourlyTrend.categories"
            :series="hourlyTrend.series"
            height="100%"
          />
        </FbkScreenPanel>

        <FbkScreenPanel title="区域销售分布" style="flex: 1 1 0; min-height: 0">
          <FbkScreenBarChart
            :categories="regionSales.categories"
            :series="regionSales.series"
            height="100%"
          />
        </FbkScreenPanel>
      </div>

      <!-- 右列 6 -->
      <div class="screen-col" style="grid-column: span 6">
        <FbkScreenPanel title="热销产品 TOP5" style="flex: 0 0 220px">
          <ol class="screen-rank">
            <li v-for="(p, i) in topProducts" :key="p.name" class="screen-rank__row">
              <span class="screen-rank__no" :class="{ 'is-top': i < 3 }">{{ i + 1 }}</span>
              <span class="screen-rank__name">{{ p.name }}</span>
              <span class="screen-rank__bar">
                <span
                  class="screen-rank__fill"
                  :style="{
                    width: `${(p.value / topProducts[0]!.value) * 100}%`,
                    background: `var(--fbk-chart-${i + 1})`,
                  }"
                />
              </span>
              <span class="screen-rank__value">{{ p.value.toLocaleString() }}</span>
            </li>
          </ol>
        </FbkScreenPanel>

        <FbkScreenPanel title="实时告警" style="flex: 1 1 0; min-height: 0">
          <FbkScreenScrollList :items="alerts" :visible-rows="5" :item-height="38" />
        </FbkScreenPanel>
      </div>
    </FbkScreenGrid>

    <!-- 底部一行：三个面板 -->
    <FbkScreenGrid :columns="24" gap="md" class="screen-bottom">
      <div class="screen-cell" style="grid-column: span 8">
        <FbkScreenPanel title="订单转化" style="height: 100%">
          <FbkScreenGaugeChart :value="76.4" label="转化率" unit="%" height="100%" />
        </FbkScreenPanel>
      </div>
      <div class="screen-cell" style="grid-column: span 8">
        <FbkScreenPanel title="实时访问量" style="height: 100%">
          <div class="screen-bignum">
            <FbkScreenNumber :value="totalVisits" size="lg" />
            <span class="screen-bignum__hint">每分钟更新</span>
          </div>
        </FbkScreenPanel>
      </div>
      <div class="screen-cell" style="grid-column: span 8">
        <FbkScreenPanel title="系统健康度" style="height: 100%">
          <div class="screen-health">
            <div v-for="(h, i) in [
              { label: 'CPU', value: 42 },
              { label: '内存', value: 68 },
              { label: '磁盘', value: 31 },
            ]" :key="h.label" class="screen-health__row">
              <span class="screen-health__label">{{ h.label }}</span>
              <span class="screen-health__bar">
                <span
                  class="screen-health__fill"
                  :style="{ width: `${h.value}%`, background: `var(--fbk-chart-${i + 1})` }"
                />
              </span>
              <span class="screen-health__value">{{ h.value }}%</span>
            </div>
          </div>
        </FbkScreenPanel>
      </div>
    </FbkScreenGrid>
  </FbkScreenPage>
</template>

<style scoped>
/* 栅格单元格必须撑满：grid 的默认 align-items 是 stretch，
   但子项内部若是 flex 容器，需要显式 min-height: 0 才能让高度往下传递。
   少了这一步，面板会收缩到标题高度，图表拿到 0 高度。 */
/* 大屏按 1920×1080 固定尺寸，高度直接写死比 flex 分配更可控。
   总高 1080 - 上下 padding(16+24) - header(80+16) - 底部(260+16) = 668 */
.screen-main {
  height: 668px;
  /* 24 列栅格需要明确宽度，否则列宽按内容收缩 */
  width: 100%;
  grid-auto-rows: minmax(0, 1fr);
}

.screen-bottom {
  width: 100%;
  height: 260px;
  margin-top: var(--fbk-spacing-lg);
  grid-auto-rows: minmax(0, 1fr);
}

.screen-col {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
  min-height: 0;
}

.screen-cell {
  min-height: 0;
}

.screen-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--fbk-spacing-lg);
}

.screen-stats__item {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-space-6);
}

.screen-stats__label {
  font-size: 13px;
  color: #94b8c4;
}

.screen-rank {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-md);
  padding: 0;
  margin: 0;
  list-style: none;
}

.screen-rank__row {
  display: grid;
  grid-template-columns: 18px minmax(70px, 1fr) minmax(60px, 1fr) auto;
  gap: var(--fbk-spacing-md);
  align-items: center;
  font-size: 13px;
  color: #e6f7fb;
}

.screen-rank__no {
  font-family: ui-monospace, Menlo, monospace;
  color: #94b8c4;
  text-align: center;
}

.screen-rank__no.is-top {
  font-weight: 600;
  color: #22d3ee;
}

.screen-rank__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screen-rank__bar {
  height: 5px;
  overflow: hidden;
  background: rgba(34, 211, 238, 0.1);
  border-radius: 3px;
}

.screen-rank__fill {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.screen-rank__value {
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: #22d3ee;
  text-align: right;
}

.screen-bignum {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-sm);
  align-items: center;
  justify-content: center;
  height: 100%;
}

.screen-bignum__hint {
  font-size: 13px;
  color: #94b8c4;
}

.screen-health {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
  justify-content: center;
  height: 100%;
}

.screen-health__row {
  display: grid;
  grid-template-columns: 40px 1fr 48px;
  gap: var(--fbk-spacing-md);
  align-items: center;
  font-size: 13px;
}

.screen-health__label {
  color: #94b8c4;
}

.screen-health__bar {
  height: 8px;
  overflow: hidden;
  background: rgba(34, 211, 238, 0.1);
  border-radius: 4px;
}

.screen-health__fill {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.screen-health__value {
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: #e6f7fb;
  text-align: right;
}
</style>
