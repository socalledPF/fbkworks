<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, shallowRef, useAttrs, useSlots, watch } from 'vue'
import { useAdapter } from '@fbkworks/adapter-core'
import { FbkDetailPage } from '../detail-page'
import type { DetailPageExpose } from '../detail-page'
import { useMobileViewport } from './use-mobile'
import type { DetailDrawerExpose, DetailDrawerProps } from './types'

/**
 * 详情抽屉。
 *
 * 设计见 docs/design/2026-10-28-p4-2-detail-drawer.md。
 *
 * **它不实现字段渲染，也不实现三态。** 内容区整体就是 `FbkDetailPage`
 * （只是把它的页面头部关掉）：同一份 `request`、同一次 `useDetail` 请求、
 * 同一套 `DescriptionItem` 与 `field-${key}` 插槽、同一个 404 判定。
 * 如果这里另写一套字段渲染，同一份数据在页面里和抽屉里就会慢慢分叉。
 *
 * 它自己只负责三件事：
 *   · 装进哪个原语容器（Drawer）、朝哪边滑、多宽
 *   · 把内层页面的标题提取到抽屉标题栏（数据由内层加载后回传）
 *   · 提供「展开为整页」出口 —— 只发事件，不做路由跳转
 */
defineOptions({ name: 'FbkDetailDrawer', inheritAttrs: false })

const props = withDefaults(defineProps<DetailDrawerProps<T>>(), {
  show: false,
  title: undefined,
  width: 480,
  closeOnClickModal: true,
  showClose: true,
  expandText: '展开为整页',
  showExpand: true,
  column: 1,
  groups: undefined,
  emptyText: undefined,
  bordered: false,
  direction: 'horizontal',
  size: 'md',
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()
const slots = useSlots()

const adapter = useAdapter()
const { Drawer, Button } = adapter.primitives

const { isMobile } = useMobileViewport()

const emit = defineEmits<{
  'update:show': [show: boolean]
  /** 抽屉关闭（无论点关闭控件、点遮罩还是调用方自己改 show） */
  close: []
  /** 请求「展开为整页」，payload 是当前数据。导航由业务方自己做 */
  expand: [data: T | null]
  load: [data: T]
  error: [error: unknown]
}>()

const innerRef = ref<DetailPageExpose<T>>()
/** 内层加载回来的数据：只为抽屉标题栏服务 */
const loaded = shallowRef<T | null>(null)
/** 每次打开递增，作为内层 DetailPage 的 key —— 强制重建即重新请求 */
const session = ref(0)

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    // 上一行的标题不该在新数据回来前继续显示
    loaded.value = null
    session.value += 1
  },
  { immediate: true },
)

/** 手机没有横向空间：底部弹出铺满整屏；桌面从右侧滑出 */
const placement = computed<'right' | 'bottom'>(() => (isMobile.value ? 'bottom' : 'right'))

/**
 * 移动端宽度交给「铺满」语义。
 *
 * 三个适配器在 bottom 方向都会忽略 width（element-plus 用 btt 方向、
 * naive 用 height:100%、vant 直接 width:100%），这里显式传 '100%'
 * 是为了让「铺满」在契约层可见，而不是依赖各家默认值。
 */
const resolvedWidth = computed<string | number>(() => (isMobile.value ? '100%' : props.width))

const resolvedTitle = computed(() => {
  if (typeof props.title === 'function') return loaded.value ? props.title(loaded.value) : ''
  return props.title ?? ''
})

/** actions 在模板里单独处理（要并进「展开为整页」），其余插槽原样转发 */
const forwardedSlots = computed(() => Object.keys(slots).filter((name) => name !== 'actions'))

function setShow(next: boolean) {
  // 受控：父级没改 show 时重复收到同一个值不该再发一遍 close
  if (next === props.show) return
  emit('update:show', next)
  if (!next) emit('close')
}

function close() {
  if (!props.show) return
  emit('update:show', false)
  emit('close')
}

function onLoad(data: T) {
  loaded.value = data
  emit('load', data)
}

function onError(error: unknown) {
  emit('error', error)
}

defineExpose<DetailDrawerExpose<T>>({
  get data() {
    return loaded.value
  },
  reload: async () => {
    await innerRef.value?.reload()
  },
  close,
})
</script>

<template>
  <component
    :is="Drawer"
    v-bind="attrs"
    :model-value="show"
    :title="resolvedTitle"
    :width="resolvedWidth"
    :placement="placement"
    :close-on-click-modal="closeOnClickModal"
    :show-close="showClose"
    @update:model-value="setShow"
  >
    <FbkDetailPage
      :key="session"
      ref="innerRef"
      :request="request"
      :items="items"
      :show-header="false"
      :column="column"
      :groups="groups"
      :empty-text="emptyText"
      :bordered="bordered"
      :direction="direction"
      :size="size"
      @load="onLoad"
      @error="onError"
    >
      <!-- 字段级与其它插槽原样下传：调用方写的仍是 DetailPage 那套 field-${key} -->
      <template v-for="name in forwardedSlots" #[name]="slotProps" :key="name">
        <slot :name="name" v-bind="slotProps" />
      </template>

      <!-- 「展开为整页」并进详情页自己的操作区：那一行已经有边框与右对齐 -->
      <template v-if="showExpand || $slots.actions" #actions="{ data }">
        <slot name="actions" :data="data" />
        <component
          :is="Button"
          v-if="showExpand"
          variant="text"
          @click="emit('expand', data)"
        >
          {{ expandText }}
        </component>
      </template>
    </FbkDetailPage>
  </component>
</template>
