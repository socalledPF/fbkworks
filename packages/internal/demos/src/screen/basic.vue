<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
} from '@fbk/screen'
import { alerts, channelShare, hourlyTrend, regionSales, topProducts } from './data'

/**
 * 实时监控仪表盘。
 *
 * 设计见 docs/design/2026-10-25-minimal-and-monitoring-redesign.md。
 *
 * 与上一版（科技蓝发光大屏）的区别：
 *   · 状态灯替代装饰性标题栏 —— 先看「有没有异常」
 *   · 限值线替代纯趋势图 —— 知道「多少算异常」
 *   · 最后更新时间 —— 知道数据新鲜度
 *   · 去掉发光/网格/四角装饰 —— 它们不编码任何信息
 *
 * 信息优先级（从上到下）：
 *   1. 状态条（有没有问题）
 *   2. 关键指标 + 主趋势（问题在哪）
 *   3. 告警流（具体是什么）
 *   4. 分布类（辅助判断）
 */

// ---------- 模拟实时数据 ----------

const updatedAt = ref(new Date())
const liveVisits = ref(24680)
const cpuLoad = ref(42)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 每 5 秒刷新一次：监控大屏的刷新频率应该是「人能反应」的节奏，
  // 太快反而看不清变化
  timer = setInterval(() => {
    updatedAt.value = new Date()
    liveVisits.value += Math.floor(Math.random() * 40) - 15
    cpuLoad.value = Math.max(20, Math.min(95, cpuLoad.value + Math.floor(Math.random() * 11) - 5))
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const pad = (n: number) => String(n).padStart(2, '0')
const clockText = computed(() => {
  const d = updatedAt.value
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

// ---------- 状态判定 ----------

/** CPU 超过 80 视为警告，超过 90 视为异常 */
const cpuLevel = computed(() =>
  cpuLoad.value >= 90 ? 'alert' : cpuLoad.value >= 80 ? 'warn' : 'ok',
)

/** 全局状态：取所有子状态的最高级别 */
const globalStatus = computed(() => {
  if (cpuLevel.value === 'alert') return { level: 'alert' as const, text: '系统负载异常' }
  if (cpuLevel.value === 'warn') return { level: 'warn' as const, text: '系统负载偏高' }
  return { level: 'ok' as const, text: '全部正常' }
})

// ---------- 指标 ----------

const kpis = computed(() => [
  { label: '今日访问', value: liveVisits.value, suffix: '', prefix: undefined, precision: 0 },
  { label: '订单总数', value: 8642, suffix: '', prefix: undefined, precision: 0 },
  { label: '销售额', value: 4820000, suffix: '', prefix: '¥', precision: 0 },
  { label: '转化率', value: 3.82, suffix: '%', prefix: undefined, precision: 2 },
])

/** 主趋势带阈值线：让「多少算异常」显式可见 */
const trafficThreshold = 6000

const loadMetrics = computed(() => [
  { label: 'CPU', value: cpuLoad.value, limit: 80 },
  { label: '内存', value: 68, limit: 85 },
  { label: '磁盘', value: 31, limit: 90 },
])
</script>

<template>
  <FbkScreenPage>
    <!-- 状态条：第一信息是「有没有异常」，不是标题 -->
    <FbkScreenHeader title="运营监控" :status="globalStatus" :clock="true">
      <template #left>
        <span class="mono">{{ clockText }}</span>
      </template>
    </FbkScreenHeader>

    <!-- 上区：关键指标 + 主趋势 + 告警流 -->
    <FbkScreenGrid :columns="24" gap="md" class="mon-main">
      <!-- 关键指标 -->
      <div class="mon-col" style="grid-column: span 5">
        <FbkScreenPanel title="关键指标" :level="globalStatus.level" style="flex: 0 0 190px">
          <template #extra>实时</template>
          <div class="mon-kpis">
            <div v-for="k in kpis" :key="k.label" class="mon-kpi">
              <span class="mon-kpi__label">{{ k.label }}</span>
              <FbkScreenNumber
                :value="k.value"
                :prefix="k.prefix"
                :suffix="k.suffix"
                :precision="k.precision"
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
            height="100%"
          />
        </FbkScreenPanel>
      </div>

      <!-- 主趋势：带限值线 -->
      <div class="mon-col" style="grid-column: span 13">
        <FbkScreenPanel
          title="实时流量"
          :level="globalStatus.level"
          style="flex: 1 1 0; min-height: 0"
        >
          <template #extra>近 24 小时</template>
          <FbkScreenLineChart
            :categories="hourlyTrend.categories"
            :series="hourlyTrend.series"
            :threshold="trafficThreshold"
            threshold-label="告警阈值"
            height="100%"
          />
        </FbkScreenPanel>

        <FbkScreenPanel title="区域分布" style="flex: 0 0 200px">
          <FbkScreenBarChart
            :categories="regionSales.categories"
            :series="regionSales.series"
            height="100%"
          />
        </FbkScreenPanel>
      </div>

      <!-- 告警流 -->
      <div class="mon-col" style="grid-column: span 6">
        <FbkScreenPanel title="实时告警" style="flex: 0 0 240px">
          <template #extra>{{ alerts.length }} 条</template>
          <FbkScreenScrollList :items="alerts" :visible-rows="6" :item-height="32" />
        </FbkScreenPanel>

        <FbkScreenPanel title="热销产品" style="flex: 1 1 0; min-height: 0">
          <ol class="mon-rank">
            <li v-for="(p, i) in topProducts" :key="p.name" class="mon-rank__row">
              <span class="mon-rank__no">{{ i + 1 }}</span>
              <span class="mon-rank__name">{{ p.name }}</span>
              <span class="mon-rank__bar">
                <span
                  class="mon-rank__fill"
                  :style="{ width: `${(p.value / topProducts[0]!.value) * 100}%` }"
                />
              </span>
              <span class="mon-rank__value">{{ p.value.toLocaleString() }}</span>
            </li>
          </ol>
        </FbkScreenPanel>
      </div>
    </FbkScreenGrid>

    <!-- 下区：系统负载 -->
    <FbkScreenGrid :columns="24" gap="md" class="mon-bottom">
      <div style="grid-column: span 8">
        <FbkScreenPanel title="系统负载" :level="cpuLevel" style="height: 100%">
          <template #extra>CPU {{ cpuLoad }}%</template>
          <div class="mon-load">
            <div v-for="m in loadMetrics" :key="m.label" class="mon-load__row">
              <span class="mon-load__label">{{ m.label }}</span>
              <span class="mon-load__bar">
                <!-- 限值刻度：知道「多少算异常」 -->
                <span class="mon-load__limit" :style="{ left: `${m.limit}%` }" />
                <span
                  class="mon-load__fill"
                  :class="{ 'is-over': m.value >= m.limit }"
                  :style="{ width: `${m.value}%` }"
                />
              </span>
              <span class="mon-load__value">{{ m.value }}%</span>
            </div>
          </div>
        </FbkScreenPanel>
      </div>

      <div style="grid-column: span 8">
        <FbkScreenPanel title="实时访问量" style="height: 100%">
          <div class="mon-big">
            <FbkScreenNumber :value="liveVisits" size="lg" />
            <span class="mon-big__hint">每 5 秒更新</span>
          </div>
        </FbkScreenPanel>
      </div>

      <div style="grid-column: span 8">
        <FbkScreenPanel title="响应延迟" style="height: 100%">
          <template #extra>P95 380ms</template>
          <FbkScreenLineChart
            :categories="['12:00', '12:10', '12:20', '12:30', '12:40', '12:50']"
            :series="[{ name: '延迟', data: [180, 220, 195, 310, 280, 380] }]"
            :threshold="300"
            threshold-label="SLO"
            height="100%"
          />
        </FbkScreenPanel>
      </div>
    </FbkScreenGrid>
  </FbkScreenPage>
</template>

<style scoped>
/* 布局尺寸：1920×1080 基准 */
.mon-main {
  flex: 1 1 0;
  min-height: 0;
  grid-auto-rows: minmax(0, 1fr);
}

.mon-bottom {
  flex: 0 0 200px;
  grid-auto-rows: minmax(0, 1fr);
}

.mon-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.mono {
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

/* ---- 关键指标 ---- */
.mon-kpis {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}

.mon-kpi {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.mon-kpi__label {
  color: #6f7885;
  font-size: 12px;
}

/* ---- 排行榜 ---- */
.mon-rank {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  padding: 0;
  margin: 0;
  list-style: none;
}

.mon-rank__row {
  display: grid;
  grid-template-columns: 14px minmax(60px, 1fr) minmax(40px, 1fr) auto;
  gap: 8px;
  align-items: center;
  color: #c5ccd4;
  font-size: 11px;
}

.mon-rank__no {
  color: #6f7885;
  font-family: ui-monospace, Menlo, monospace;
  text-align: center;
}

.mon-rank__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mon-rank__bar {
  height: 3px;
  overflow: hidden;
  background: #262c34;
  border-radius: 2px;
}

.mon-rank__fill {
  display: block;
  height: 100%;
  background: #6a7fb0;
  border-radius: 2px;
}

.mon-rank__value {
  color: #e8ecf0;
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ---- 系统负载 ---- */
.mon-load {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
}

.mon-load__row {
  display: grid;
  grid-template-columns: 34px 1fr 40px;
  gap: 10px;
  align-items: center;
  font-size: 11px;
}

.mon-load__label {
  color: #6f7885;
}

.mon-load__bar {
  position: relative;
  height: 6px;
  background: #262c34;
  border-radius: 3px;
}

/* 限值刻度：一条细竖线标出「到这里算异常」 */
.mon-load__limit {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 1px;
  background: #c05a4a;
  opacity: 0.6;
}

.mon-load__fill {
  display: block;
  height: 100%;
  background: #4a9d7f;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.mon-load__fill.is-over {
  background: #c9973f;
}

.mon-load__value {
  color: #e8ecf0;
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ---- 大数字 ---- */
.mon-big {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.mon-big__hint {
  color: #6f7885;
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .mon-load__fill {
    transition: none;
  }
}
</style>
