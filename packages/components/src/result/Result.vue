<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { RESULT_DEFAULTS, type ResultProps, type ResultStatus } from './types'

/**
 * 异常状态页。纯展示组件，不经过适配层 —— 只用 tokens 与 CSS。
 *
 * 图标用内联 SVG 而不是 emoji：emoji 在不同平台的字形差异极大
 * （同一个 ✅ 在 Windows 与 macOS 上颜色、比例都不同），
 * 状态页恰恰是最需要「看起来一致」的场合。
 */
defineOptions({ name: 'FbkResult', inheritAttrs: false })

const props = withDefaults(defineProps<ResultProps>(), {
  status: 'info',
  title: undefined,
  subtitle: undefined,
  extra: undefined,
})

const attrs = useAttrs()

const isCode = computed(() => /^\d{3}$/.test(String(props.status)))

/**
 * 未知 status 回退到 info。
 *
 * status 是运行时字符串，后端返回码（401 / 402 / 422 …）永远比 ResultStatus 宽；
 * 直接下标取默认值会拿到 undefined，随后读 .title 整块白屏。
 */
const defaults = computed(
  () => RESULT_DEFAULTS[props.status as ResultStatus] ?? RESULT_DEFAULTS.info,
)

const title = computed(() => props.title ?? defaults.value.title)
const subtitle = computed(() => props.subtitle ?? defaults.value.subtitle)

/** 数字状态码（403/404/500）用主色；其余用语义色 */
const tone = computed(() => {
  const s = String(props.status)
  if (s === 'success') return 'success'
  if (s === 'warning') return 'warning'
  if (s === 'error' || s === '500') return 'danger'
  if (s === '403') return 'warning'
  return 'info'
})
</script>

<template>
  <div class="fbk-result" v-bind="attrs" :class="`fbk-result--${tone}`" :data-status="status">
    <div class="fbk-result__icon">
      <slot name="icon">
        <span v-if="isCode" class="fbk-result__code">{{ status }}</span>
        <svg
          v-else
          class="fbk-result__glyph"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="status === 'success'">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
          </template>
          <template v-else-if="status === 'warning'">
            <path d="M12 3.5L21 19H3z" />
            <path d="M12 9.5v4" />
            <path d="M12 16.5h.01" />
          </template>
          <template v-else-if="status === 'error'">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4.5" />
            <path d="M12 16h.01" />
          </template>
        </svg>
      </slot>
    </div>

    <h2 class="fbk-result__title">{{ title }}</h2>
    <p v-if="subtitle" class="fbk-result__subtitle">{{ subtitle }}</p>

    <div v-if="$slots.default" class="fbk-result__content">
      <slot />
    </div>

    <p v-if="extra" class="fbk-result__extra">{{ extra }}</p>

    <div v-if="$slots.actions" class="fbk-result__actions">
      <slot name="actions" />
    </div>
  </div>
</template>
