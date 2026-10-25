<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useAdapter } from '@fbk/adapter-core'
import { toCssSize } from '@fbk/shared'
import type { PageContainerProps } from './types'

defineOptions({ name: 'FbkPageContainer', inheritAttrs: false })

const props = withDefaults(defineProps<PageContainerProps>(), {
  title: undefined,
  subtitle: undefined,
  back: false,
  breadcrumbs: undefined,
  loading: false,
  fixedHeader: false,
  showHeader: true,
  showFooter: false,
  maxWidth: undefined,
  uiProps: undefined,
})

const attrs = useAttrs()

const emit = defineEmits<{
  back: []
}>()

const adapter = useAdapter()
const { Button, Spin } = adapter.primitives

/** 只写传进来的值。不传时交给组件令牌的 --fbk-page-container-max-width，
    否则组件层永远拿不到消费方在 CSS 里设的默认值。 */
const style = computed(() => {
  const maxWidth = toCssSize(props.maxWidth)
  return maxWidth ? { '--fbk-page-container-max-width': maxWidth } : {}
})

function onBack() {
  if (typeof props.back === 'function') props.back()
  emit('back')
}
</script>

<template>
  <div
    class="fbk-page-container"
    v-bind="attrs"
    :class="{ 'fbk-page-container--fixed': fixedHeader }"
    :style="style"
  >
    <header v-if="showHeader" class="fbk-page-container__header" v-bind="uiProps?.header">
      <div class="fbk-page-container__heading">
        <component
          :is="Button"
          v-if="back"
          variant="text"
          class="fbk-page-container__back"
          v-bind="uiProps?.backButton"
          @click="onBack"
        >
          <slot name="back">← 返回</slot>
        </component>

        <slot name="breadcrumbs">
          <nav v-if="breadcrumbs?.length" class="fbk-page-container__breadcrumbs">
            <template v-for="(item, index) in breadcrumbs" :key="item.text">
              <a v-if="item.to" :href="item.to" class="fbk-page-container__breadcrumb-link">{{ item.text }}</a>
              <span v-else class="fbk-page-container__breadcrumb-text">{{ item.text }}</span>
              <span v-if="index < breadcrumbs.length - 1" class="fbk-page-container__separator">/</span>
            </template>
          </nav>
        </slot>

        <div class="fbk-page-container__title-row">
          <slot name="title">
            <h1 v-if="title" class="fbk-page-container__title">{{ title }}</h1>
          </slot>
          <p v-if="subtitle" class="fbk-page-container__subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div class="fbk-page-container__extra">
        <slot name="extra" />
      </div>
    </header>

    <main class="fbk-page-container__body">
      <component :is="Spin" v-if="loading" :loading="true">
        <slot />
      </component>
      <slot v-else />
    </main>

    <footer v-if="showFooter || $slots.footer" class="fbk-page-container__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
