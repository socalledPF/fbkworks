<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref } from 'vue'
import { resolveColumns, toCssSize } from '@fbk/shared'
import type { DescriptionItem, DescriptionsProps, ResolvedGroup } from './types'

/**
 * 纯展示组件：不经过适配层，只用 tokens + CSS Grid。
 * 它证明"不是所有组件都需要适配器"。
 */
defineOptions({ name: 'FbkDescriptions', inheritAttrs: false })

const props = withDefaults(defineProps<DescriptionsProps<T>>(), {
  groups: undefined,
  column: 2,
  bordered: false,
  direction: 'horizontal',
  size: 'md',
  labelWidth: undefined,
  groupGap: 'md',
})

/**
 * 分组解析。
 *
 * 规则（按优先级）：
 *   1. item.groups 明确包含某个分组的 key → 进该分组
 *   2. item.groups 是空数组、或全是未知 key → 落到最后的无标题区
 *   3. item.groups 未传 → 进第一个分组（最常见的「只想分段」场景）
 *
 * 第 2 条刻意不丢弃数据：写错 group key 时条目仍然可见，
 * 否则会变成「少了一个字段但没人发现」的静默丢数据。
 */
const resolvedGroups = computed<ResolvedGroup<T>[]>(() => {
  if (!props.groups?.length) {
    return [
      {
        key: '__all__',
        items: props.items,
        collapsible: false,
        defaultCollapsed: false,
      },
    ]
  }

  const known = new Set(props.groups.map((group) => group.key))
  const buckets = new Map<string, DescriptionItem<T>[]>()
  for (const group of props.groups) buckets.set(group.key, [])
  const orphans: DescriptionItem<T>[] = []

  for (const item of props.items) {
    if (item.groups === undefined) {
      buckets.get(props.groups[0]!.key)!.push(item)
      continue
    }
    const targets = item.groups.filter((key) => known.has(key))
    if (!targets.length) {
      orphans.push(item)
      continue
    }
    for (const key of targets) buckets.get(key)!.push(item)
  }

  const result: ResolvedGroup<T>[] = props.groups
    .filter((group) => (buckets.get(group.key)?.length ?? 0) > 0)
    .map((group) => ({
      key: group.key,
      title: group.title,
      items: buckets.get(group.key)!,
      column: group.column,
      collapsible: group.collapsible ?? false,
      defaultCollapsed: group.defaultCollapsed ?? false,
    }))

  if (orphans.length) {
    result.push({
      key: '__orphans__',
      items: orphans,
      collapsible: false,
      defaultCollapsed: false,
    })
  }

  return result
})

/** 折叠状态，按分组 key 记录 */
const collapsed = ref<Record<string, boolean>>(
  Object.fromEntries(
    (props.groups ?? [])
      .filter((group) => group.collapsible && group.defaultCollapsed)
      .map((group) => [group.key, true]),
  ),
)

function toggle(key: string) {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] }
}

/** 组件级样式：字号与标签宽度 */
const style = computed(() => {
  const labelWidth = toCssSize(props.labelWidth)
  return {
    ...(labelWidth ? { '--fbk-descriptions-label-width': labelWidth } : {}),
    ...(props.size ? { '--fbk-descriptions-size': `var(--fbk-descriptions-size-${props.size})` } : {}),
  }
})

/** 每个分组可能有自己的列数，展开成独立的 --fbk-cols-* 变量 */
function groupStyle(group: ResolvedGroup<T>) {
  return resolveColumns(group.column ?? props.column)
}

function valueOf(item: DescriptionItem<T>) {
  if (item.getValue) return item.getValue(props.data)
  const key = item.dataIndex ?? item.key
  return (props.data as Record<string, unknown>)[key]
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === ''
}

/** render 返回的是 VNode，用函数式组件包一层才能在模板里直接 <component :is> */
function renderItem(item: DescriptionItem<T>) {
  return () => item.render!({ row: props.data, value: valueOf(item) })
}
</script>

<template>
  <div class="fbk-descriptions" :class="`fbk-descriptions--gap-${groupGap}`" :style="style">
    <section
      v-for="group in resolvedGroups"
      :key="group.key"
      class="fbk-descriptions__group"
      :data-group="group.key"
    >
      <header v-if="group.title || group.collapsible" class="fbk-descriptions__group-header">
        <button
          v-if="group.collapsible"
          type="button"
          class="fbk-descriptions__group-toggle"
          :aria-expanded="!collapsed[group.key]"
          @click="toggle(group.key)"
        >
          <span
            class="fbk-descriptions__group-caret"
            :class="{ 'is-collapsed': collapsed[group.key] }"
            aria-hidden="true"
            >▾</span
          >
          <span v-if="group.title">{{ group.title }}</span>
        </button>
        <h3 v-else class="fbk-descriptions__group-title">{{ group.title }}</h3>
      </header>

      <dl
        v-show="!collapsed[group.key]"
        class="fbk-descriptions__grid"
        :class="{
          'fbk-descriptions--bordered': bordered,
          'fbk-descriptions--vertical': direction === 'vertical',
        }"
        :style="groupStyle(group)"
      >
        <div
          v-for="item in group.items"
          :key="item.key"
          class="fbk-descriptions__item"
          :data-key="item.key"
          :style="item.span ? { gridColumn: `span ${item.span}` } : undefined"
        >
          <dt class="fbk-descriptions__label">{{ item.label }}</dt>
          <dd class="fbk-descriptions__value">
            <slot :name="`item-${item.key}`" :row="data" :value="valueOf(item)">
              <component :is="renderItem(item)" v-if="item.render" />
              <template v-else-if="isEmpty(valueOf(item))">{{ item.emptyText ?? '-' }}</template>
              <template v-else>{{ valueOf(item) }}</template>
            </slot>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
