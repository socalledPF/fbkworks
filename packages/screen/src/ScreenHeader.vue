<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'
import type { ScreenHeaderProps } from './types'

/**
 * 大屏顶部状态条。
 *
 * **它不是标题栏，是状态条。** 这是本次重新设计最关键的认知转变：
 * 值班人员打开大屏的第一件事不是「看标题」，而是「有没有异常」。
 *
 * 所以结构是：
 *   左：标题（小号、正常字重）
 *   中：状态灯 + 状态文案 —— 3 秒内可判断
 *   右：最后更新时间（数据新鲜度）+ 全屏
 *
 * 上一版是「大标题 + 发光 + 装饰线 + 居中布局」，
 * 那是氛围设计，不传递信息。
 */
defineOptions({ name: 'FbkScreenHeader', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenHeaderProps>(), {
  clock: true,
  fullscreen: true,
  status: undefined,
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
  <header v-bind="attrs" class="fbk-screen-header">
    <div class="fbk-screen-header__side fbk-screen-header__side--left">
      <h1 class="fbk-screen-header__title">{{ title }}</h1>
      <slot name="left" />
    </div>

    <!-- 状态灯：监控界面的第一信息 -->
    <div v-if="status" class="fbk-screen-header__center">
      <span class="fbk-screen-header__dot" :data-level="status.level" aria-hidden="true" />
      <span>{{ status.text }}</span>
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
