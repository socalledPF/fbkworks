<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import type { ScreenHeaderProps } from './types'

/**
 * 大屏顶部标题栏。
 *
 * 设计要点：
 *   · 标题字距 0.08em + text-shadow 发光 —— 科技感的主要来源
 *   · 底部装饰线用渐变（透明→青→透明），而不是实线
 *   · 时间与全屏按钮绝对定位在两端，标题始终居中
 */
defineOptions({ name: 'FbkScreenHeader', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenHeaderProps>(), {
  clock: true,
  fullscreen: true,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

const pad = (n: number) => String(n).padStart(2, '0')

function format(d: Date) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${date} ${time}`
}

onMounted(() => {
  if (!props.clock) return
  // 每秒更新。用 setInterval 而不是 rAF：时钟不需要 60fps
  timer = setInterval(() => (now.value = new Date()), 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
})

const isFullscreen = ref(false)

async function toggleFullscreen() {
  if (typeof document === 'undefined') return
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch {
    /* 某些环境（iframe 无 allowfullscreen）会拒绝，静默忽略 */
  }
}
</script>

<template>
  <header class="fbk-screen-header" v-bind="attrs">
    <div class="fbk-screen-header__side fbk-screen-header__side--left">
      <slot name="left" />
    </div>

    <div class="fbk-screen-header__center">
      <h1 class="fbk-screen-header__title">{{ title }}</h1>
      <div class="fbk-screen-header__decoration" aria-hidden="true" />
    </div>

    <div class="fbk-screen-header__side fbk-screen-header__side--right">
      <slot name="right">
        <time v-if="clock" class="fbk-screen-header__clock">{{ format(now) }}</time>
        <button
          v-if="fullscreen"
          type="button"
          class="fbk-screen-header__fullscreen"
          :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
      </slot>
    </div>
  </header>
</template>
