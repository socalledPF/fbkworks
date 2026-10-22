<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ScreenGridProps } from './types'

/**
 * 大屏栅格。默认 24 列 —— 大屏需要比 12 列更细的切分。
 *
 * 用 inline style 写 `grid-template-columns` 而不是 CSS 类：
 * 列数是运行时 props，穷举类名不现实。
 */
defineOptions({ name: 'FbkScreenGrid', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenGridProps>(), {
  columns: 24,
  gap: 'md',
  rows: undefined,
})

const style = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
  ...(props.rows ? { gridTemplateRows: props.rows } : {}),
}))

/* inheritAttrs: false 时 class / style 不会自动落到根元素 ——
   必须手动转发，否则调用方写的 class="screen-main" 完全失效。
   实测症状：给 Grid 加 class 后高度设置不生效，面板收缩成标题高度。 */
const attrs = useAttrs()
</script>

<template>
  <div v-bind="attrs" class="fbk-screen-grid" :class="`fbk-screen-grid--gap-${gap}`" :style="style">
    <slot />
  </div>
</template>
