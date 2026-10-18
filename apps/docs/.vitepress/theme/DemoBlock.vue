<script setup lang="ts">
import { computed, ref } from 'vue'
import { getDemo, getDemoSource } from '@fbk/demos'

const props = defineProps<{
  /** demo 注册表里的 id，例如 `pro-table/basic` */
  id: string
  title?: string
}>()

const demo = computed(() => getDemo(props.id))
const source = computed(() => getDemoSource(props.id) ?? '')
const showSource = ref(false)
const copied = ref(false)

async function copySource() {
  try {
    await navigator.clipboard.writeText(source.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // 非安全上下文下 clipboard 不可用，忽略即可
  }
}
</script>

<template>
  <section class="fbk-demo">
    <header class="fbk-demo__header">
      <span class="fbk-demo__title">{{ title ?? demo?.title ?? id }}</span>
      <div class="fbk-demo__actions">
        <button type="button" class="fbk-demo__button" @click="copySource">
          {{ copied ? '已复制' : '复制代码' }}
        </button>
        <button type="button" class="fbk-demo__button" @click="showSource = !showSource">
          {{ showSource ? '隐藏代码' : '查看代码' }}
        </button>
      </div>
    </header>

    <div class="fbk-demo__preview">
      <!--
        示例来自 @fbk/demos，与 Playground 是同一份源码。
        ClientOnly：UI 库在 SSR 下需要额外的 id / z-index provider，而 demo 本身是交互式的，
        服务端渲染没有收益，只在客户端挂载可以避免 hydration 噪音。
      -->
      <ClientOnly>
        <component :is="demo?.component" v-if="demo" />
        <p v-else class="fbk-demo__missing">未找到 demo：{{ id }}</p>
      </ClientOnly>
    </div>

    <div v-if="showSource" class="fbk-demo__source">
      <pre><code>{{ source }}</code></pre>
    </div>
  </section>
</template>
