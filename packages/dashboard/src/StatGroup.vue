<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { resolveColumns } from '@fbkworks/shared'
import type { StatGroupProps } from './types'

/**
 * 指标卡栅格。
 *
 * 列数用 `--fbk-cols-*` 变量 + CSS var() 回退链，
 * 与 QueryForm / FormGenerator 同一套机制（见 @fbkworks/shared 的 resolveColumns）。
 */
defineOptions({ name: 'FbkStatGroup', inheritAttrs: false })

const props = withDefaults(defineProps<StatGroupProps>(), {
  columns: 4,
  gap: 'md',
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const style = computed(() => resolveColumns(props.columns))
</script>

<template>
  <div class="fbk-stat-group" v-bind="attrs" :class="`fbk-stat-group--gap-${gap}`" :style="style">
    <slot />
  </div>
</template>
