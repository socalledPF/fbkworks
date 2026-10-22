<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import type { ScreenPageProps } from './types'

/**
 * 大屏根容器：等比缩放到视口。
 *
 * 缩放策略（关键决策）：
 *   按 1920×1080 设计稿写死像素，用 `transform: scale()` 整体缩放。
 *   取 min(scaleX, scaleY) 保证不变形，多出来的空间居中留边。
 *
 * 为什么不用 vw/vh 或 rem 自适应：
 *   大屏里图表、字号、间距全都按固定像素设计，用相对单位会让
 *   "1920 下正好放 8 个面板"变成"1440 下放不下"。等比缩放保证
 *   任何分辨率下看到的**构图完全一致**，只是整体大小不同。
 *
 * 为什么用 ResizeObserver 而不是 window.resize：
 *   大屏可能嵌在 iframe 或带侧边栏的容器里，容器变化时 window 不触发。
 */
defineOptions({ name: 'FbkScreenPage', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenPageProps>(), {
  designWidth: 1920,
  designHeight: 1080,
  mode: 'fit',
  grid: true,
  glow: true,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const viewport = ref<HTMLDivElement>()
const scale = ref(1)
/** fill 模式下单独记录宽高缩放 */
const scaleX = ref(1)
const scaleY = ref(1)

/**
 * 舞台定位。
 *
 * 数学要点（这里踩过坑）：`translate(-50%, -50%)` 的百分比相对
 * **元素自身尺寸**，而 `transform-origin: top left` 让缩放以左上角为基准。
 * 两者组合时，必须先 `scale` 再 `translate` —— 这样 translate 的 -50%
 * 会作用在已缩放的坐标系里，元素中心才真正对齐父级中心。
 *
 * 顺序写反（translate 在前）时，实测舞台顶部偏移 24.5px、底部溢出。
 *
 * 更简单的替代方案是 `left:50%; top:50%; transform-origin: center`，
 * 但那样缩放原点不在左上角，子元素的像素对齐会随缩放比例变化。
 */
const stageStyle = computed(() => {
  const sx = props.mode === 'fill' ? scaleX.value : scale.value
  const sy = props.mode === 'fill' ? scaleY.value : scale.value
  const scaleExpr = sx === sy ? `scale(${sx})` : `scale(${sx}, ${sy})`

  return {
    width: `${props.designWidth}px`,
    height: `${props.designHeight}px`,
    transform: `${scaleExpr} translate(-50%, -50%)`,
  }
})

function recalc() {
  const el = viewport.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  if (!width || !height) return

  const sx = width / props.designWidth
  const sy = height / props.designHeight
  scaleX.value = sx
  scaleY.value = sy
  // fit 取小值，保证完整可见且不变形
  scale.value = Math.min(sx, sy)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  recalc()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    observer = new ResizeObserver(() => recalc())
    observer.observe(viewport.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

defineExpose({ recalc, scale })
</script>

<template>
  <div
    ref="viewport"
    class="fbk-screen" v-bind="attrs"
    :class="{
      'fbk-screen--grid': grid,
      'fbk-screen--glow': glow,
    }"
  >
    <!-- 舞台：按设计稿尺寸渲染，再整体缩放。
         缩放原点必须是左上角，否则居中的 transform-origin 会让
         scale 后的元素偏移到视口外。 -->
    <div class="fbk-screen__stage" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>
