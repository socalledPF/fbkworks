<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, useAttrs, useSlots, watch } from 'vue'
import { FbkPageContainer } from '../page-container'
import { FbkDescriptions } from '../descriptions'
import { FbkResult } from '../result'
import { useDetail } from './use-detail'
import type { DetailPageProps } from './types'

/**
 * 详情页。
 *
 * 设计见 docs/design/2026-10-25-detail-page.md。
 *
 * **它不实现任何渲染逻辑，只做编排。**
 *   PageContainer → 标题 / 面包屑 / 返回
 *   三态分支     → 骨架 / Result(error) / Result(404)
 *   Descriptions → 字段渲染
 *
 * 这样做的好处：三态表现与 CrudPage 完全一致，且改一处两处都变。
 */
defineOptions({ name: 'FbkDetailPage', inheritAttrs: false })

const props = withDefaults(defineProps<DetailPageProps<T>>(), {
  title: undefined,
  subtitle: undefined,
  breadcrumbs: undefined,
  back: false,
  column: 2,
  groups: undefined,
  emptyText: undefined,
  bordered: false,
  direction: 'horizontal',
  size: 'md',
  immediate: true,
  showHeader: true,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()
const slots = useSlots()

const emit = defineEmits<{
  /** 数据加载成功 */
  load: [data: T]
  /** 加载失败 */
  error: [error: unknown]
  back: []
}>()

const { data, loading, error, reload } = useDetail<T>({
  fetcher: props.request,
  immediate: props.immediate,
  onError: (err) => emit('error', err),
})

// 加载成功后通知外部（用于打点、联动等）
watch(data, (next) => {
  if (next) emit('load', next)
})

/** 标题可以是字符串或取数据的函数 */
const resolvedTitle = computed(() => {
  if (typeof props.title === 'function') {
    return data.value ? props.title(data.value) : ''
  }
  return props.title
})

/**
 * 404 判定：请求成功但返回 null。
 *
 * 注意与 error 区分：
 *   null      → 资源不存在（404）—— 不是异常
 *   error     → 请求失败（网络/服务端）—— 是异常，可重试
 */
const notFound = computed(() => !loading.value && !error.value && data.value === null)

const FIELD_SLOT_PREFIX = 'field-'
const ITEM_SLOT_PREFIX = 'item-'

/** 调用方传进来的单字段插槽名（对外公开的是 field-${key}） */
const fieldSlots = computed(() =>
  Object.keys(slots).filter((name) => name.startsWith(FIELD_SLOT_PREFIX)),
)

/**
 * 自己的公开插槽是 field-${key}，Descriptions 读的是 item-${key}。
 * 两个名字必须在这层对齐：原样转发会让 field- 静默失效。
 */
function toItemSlotName(name: string) {
  return `${ITEM_SLOT_PREFIX}${name.slice(FIELD_SLOT_PREFIX.length)}`
}

function onBack() {
  if (typeof props.back === 'function') props.back()
  emit('back')
}

defineExpose({
  get data() {
    return data.value
  },
  get loading() {
    return loading.value
  },
  get error() {
    return error.value
  },
  reload,
})
</script>

<template>
  <FbkPageContainer
    v-bind="attrs"
    :title="resolvedTitle"
    :subtitle="subtitle"
    :breadcrumbs="breadcrumbs"
    :back="back"
    :show-header="showHeader"
    @back="onBack"
  >
    <!-- 加载态：骨架而不是「加载中…」文字 —— 文字会闪，骨架不会 -->
    <div v-if="loading" class="fbk-detail-page__skeleton">
      <slot name="loading">
        <div v-for="i in 6" :key="i" class="fbk-detail-page__skeleton-row" />
      </slot>
    </div>

    <!-- 错误态：可重试，错误要能自我恢复 -->
    <slot v-else-if="error" name="error" :error="error" :retry="reload">
      <FbkResult
        status="error"
        title="加载失败"
        :subtitle="error instanceof Error ? error.message : String(error)"
      >
        <template #default>
          <button type="button" class="fbk-detail-page__btn" @click="reload">重试</button>
        </template>
      </FbkResult>
    </slot>

    <!-- 404：请求成功但资源不存在。这不是错误，不该显示「加载失败」 -->
    <FbkResult
      v-else-if="notFound"
      status="404"
      title="内容不存在"
      subtitle="该记录可能已被删除，或链接有误。"
    >
      <template #default>
        <button v-if="back" type="button" class="fbk-detail-page__btn" @click="onBack">
          返回
        </button>
      </template>
    </FbkResult>

    <!-- 正常态 -->
    <div v-else-if="data" class="fbk-detail-page">
      <FbkDescriptions
        :items="items"
        :data="data"
        :column="column"
        :groups="groups"
        :empty-text="emptyText"
        :bordered="bordered"
        :direction="direction"
        :size="size"
      >
        <!-- 字段级插槽透传：把对外的 field- 前缀映射成 Descriptions 认的 item- 前缀 -->
        <template v-for="name in fieldSlots" #[toItemSlotName(name)]="slotProps" :key="name">
          <slot :name="name" :data="data" v-bind="slotProps" />
        </template>
      </FbkDescriptions>

      <div v-if="$slots.extra" class="fbk-detail-page__extra">
        <slot name="extra" :data="data" />
      </div>

      <div v-if="$slots.actions" class="fbk-detail-page__actions">
        <slot name="actions" :data="data" />
      </div>
    </div>
  </FbkPageContainer>
</template>
