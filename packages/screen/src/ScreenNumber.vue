<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import type { ScreenNumberProps } from './types'

/**
 * 数字翻牌。
 *
 * 数值变化时用 rAF 从旧值过渡到新值 —— 静态数字在大屏上不够抓眼，
 * 但动画必须尊重 prefers-reduced-motion（前庭功能障碍用户）。
 */
defineOptions({ name: 'FbkScreenNumber', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenNumberProps>(), {
  precision: 0,
  prefix: undefined,
  suffix: undefined,
  duration: 800,
  size: 'md',
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const display = ref(props.value)
let frame: number | null = null

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function animateTo(target: number) {
  if (frame !== null) cancelAnimationFrame(frame)

  if (prefersReducedMotion() || props.duration <= 0) {
    display.value = target
    return
  }

  const from = display.value
  const delta = target - from
  const start = performance.now()

  const step = (now: number) => {
    const progress = Math.min((now - start) / props.duration, 1)
    // ease-out：开头快结尾慢，数字"落定"的感觉更稳
    const eased = 1 - (1 - progress) ** 3
    display.value = from + delta * eased
    if (progress < 1) {
      frame = requestAnimationFrame(step)
    } else {
      display.value = target
      frame = null
    }
  }
  frame = requestAnimationFrame(step)
}

watch(
  () => props.value,
  (next) => animateTo(next),
)

onBeforeUnmount(() => {
  if (frame !== null) cancelAnimationFrame(frame)
})

const text = computed(() => {
  const formatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: props.precision,
    maximumFractionDigits: props.precision,
  })
  return formatter.format(display.value)
})
</script>

<template>
  <span class="fbk-screen-number" v-bind="attrs" :class="`fbk-screen-number--${size}`">
    <span v-if="prefix" class="fbk-screen-number__affix">{{ prefix }}</span>
    <span class="fbk-screen-number__value">{{ text }}</span>
    <span v-if="suffix" class="fbk-screen-number__affix">{{ suffix }}</span>
  </span>
</template>
