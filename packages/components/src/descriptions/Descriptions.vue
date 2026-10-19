<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue'
import { resolveColumns, toCssSize } from '@fbk/shared'
import type { DescriptionsProps } from './types'

/**
 * 纯展示组件：不经过适配层，只用 tokens + CSS Grid。
 * 它证明“不是所有组件都需要适配器”。
 */
defineOptions({ name: 'FbkDescriptions', inheritAttrs: false })

const props = withDefaults(defineProps<DescriptionsProps<T>>(), {
  column: 2,
  bordered: false,
  direction: 'horizontal',
  size: 'md',
  labelWidth: undefined,
})

/**
 * 字号走组件令牌，不在这里写死像素。
 * 之前是 '12px' / '16px' / '14px' 三串字面量 —— 改字号档位要动组件源码。
 */
const style = computed(() => {
  const labelWidth = toCssSize(props.labelWidth)
  return {
    ...resolveColumns(props.column),
    /* 只写传进来的值。不传时交给令牌的默认宽度，
       否则组件层永远拿不到消费方在 CSS 里设的默认值。 */
    ...(labelWidth ? { '--fbk-descriptions-label-width': labelWidth } : {}),
    ...(props.size ? { '--fbk-descriptions-size': `var(--fbk-descriptions-size-${props.size})` } : {}),
  }
})

function valueOf(item: (typeof props.items)[number]) {
  if (item.getValue) return item.getValue(props.data)
  const key = item.dataIndex ?? item.key
  return (props.data as Record<string, unknown>)[key]
}
</script>

<template>
  <dl
    class="fbk-descriptions"
    :class="{
      'fbk-descriptions--bordered': bordered,
      'fbk-descriptions--vertical': direction === 'vertical',
    }"
    :style="style"
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="fbk-descriptions__item"
      :style="item.span ? { gridColumn: `span ${item.span}` } : undefined"
    >
      <dt class="fbk-descriptions__label">{{ item.label }}</dt>
      <dd class="fbk-descriptions__value">
        <slot :name="`item-${item.key}`" :row="data" :value="valueOf(item)">
          <template v-if="item.render">{{ item.render({ row: data, value: valueOf(item) }) }}</template>
          <template v-else-if="valueOf(item) === null || valueOf(item) === undefined || valueOf(item) === ''">-</template>
          <template v-else>{{ valueOf(item) }}</template>
        </slot>
      </dd>
    </div>
  </dl>
</template>
