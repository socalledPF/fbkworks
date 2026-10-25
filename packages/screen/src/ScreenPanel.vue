<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ScreenPanelProps } from './types'

/**
 * 大屏数据面板。
 *
 * 四角装饰用两个伪元素 + 四条边框渐变实现，不引入额外的 DOM 节点。
 * 这是大屏最常见的"科技感边框"做法。
 */
defineOptions({ name: 'FbkScreenPanel', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenPanelProps>(), {
  title: undefined,
  extra: undefined,
  height: undefined,
  corners: true,
  level: 'ok',
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const style = computed(() => {
  if (props.height === undefined) return {}
  return { height: typeof props.height === 'number' ? `${props.height}px` : props.height }
})
</script>

<template>
  <section class="fbk-screen-panel" v-bind="attrs" :class="{ 'fbk-screen-panel--corners': corners }" :style="style">
    <header v-if="title || $slots.extra" class="fbk-screen-panel__header">
      <div class="fbk-screen-panel__heading">
        <span class="fbk-screen-panel__bar" :data-level="level" aria-hidden="true" />
        <h2 class="fbk-screen-panel__title">{{ title }}</h2>
      </div>
      <div class="fbk-screen-panel__extra">
        <slot name="extra">{{ extra }}</slot>
      </div>
    </header>

    <div class="fbk-screen-panel__body">
      <slot />
    </div>
  </section>
</template>
