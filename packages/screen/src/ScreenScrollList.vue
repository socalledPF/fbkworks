<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import type { ScreenScrollListProps } from './types'

/**
 * 自动轮播列表。监控类大屏的高频组件。
 *
 * 无缝循环的做法：内容复制一份，滚到一半时瞬间归零。
 * 直接滚到末尾再跳回顶部会有明显闪动。
 */
defineOptions({ name: 'FbkScreenScrollList', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenScrollListProps>(), {
  itemHeight: 44,
  interval: 2500,
  visibleRows: 6,
  pauseOnHover: true,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const offset = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

/** 复制一份用于无缝循环 */
const loopItems = computed(() => [...props.items, ...props.items])

const containerHeight = computed(() => props.itemHeight * props.visibleRows)

const trackStyle = computed(() => ({
  transform: `translateY(-${offset.value}px)`,
  transition: offset.value === 0 ? 'none' : 'transform 0.5s ease',
}))

/**
 * 一次滚动一行。
 *
 * 无缝循环的正确做法：滚到「原始列表末尾」时把 offset 减去一个周期长度，
 * 而不是归零。因为循环内容是 items × 2，滚过 items.length 行后，
 * 第二份的第一行正好接在第一份末尾 —— 此时减掉周期长度，画面完全一致，
 * 看不出跳变。
 *
 * 早期写成"滚到底归零"，会出现一段空白（offset 归零后内容突然回到顶部，
 * 中间那段是空的）。
 */
function tick() {
  if (paused.value || props.items.length === 0) return

  const period = props.items.length * props.itemHeight
  const next = offset.value + props.itemHeight

  if (next >= period) {
    // 到达一个周期：先滚完最后一行，再瞬间回退一个周期
    offset.value = next
    setTimeout(() => {
      // 关闭过渡后回退，避免看到倒放动画
      offset.value = next - period
    }, 520)
  } else {
    offset.value = next
  }
}

onMounted(() => {
  if (props.items.length === 0) return
  timer = setInterval(tick, props.interval)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
})

function onEnter() {
  if (props.pauseOnHover) paused.value = true
}

function onLeave() {
  if (props.pauseOnHover) paused.value = false
}
</script>

<template>
  <div
    class="fbk-screen-scroll-list" v-bind="attrs"
    :style="{ height: `${containerHeight}px` }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div class="fbk-screen-scroll-list__track" :style="trackStyle">
      <div
        v-for="(item, index) in loopItems"
        :key="`${item.label}-${index}`"
        class="fbk-screen-scroll-list__row"
        :style="{ height: `${itemHeight}px` }"
        :data-status="item.status"
      >
        <span class="fbk-screen-scroll-list__dot" aria-hidden="true" />
        <span class="fbk-screen-scroll-list__label" :title="item.label">{{ item.label }}</span>
        <span v-if="item.meta" class="fbk-screen-scroll-list__meta">{{ item.meta }}</span>
        <span v-if="item.value !== undefined" class="fbk-screen-scroll-list__value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>
