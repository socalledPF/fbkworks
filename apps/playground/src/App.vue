<script setup lang="ts">
import { computed, ref } from 'vue'
import { FbkProvider } from '@fbk/adapter-core'
import type { ThemeMode } from '@fbk/adapter-core'
import { demoIds, getDemo, getDemoSource } from '@fbk/demos'
import { adapters, adapterNames, type AdapterName } from './adapters'

const adapterName = ref<AdapterName>('element-plus')
const theme = ref<ThemeMode>('light')
const demoId = ref(demoIds[0]!)

const adapter = computed(() => adapters[adapterName.value])
const demo = computed(() => getDemo(demoId.value))
const source = computed(() => getDemoSource(demoId.value))
const showSource = ref(false)

/* 大屏 demo 需要全屏宽度：它按 1920×1080 设计，
   被 max-width: 1200px 约束会裁切右列、并且不居中。 */
const isScreenDemo = computed(() => demoId.value.startsWith('screen/'))
</script>

<template>
  <div class="playground">
    <header class="playground__header">
      <strong class="playground__brand">FBK Playground</strong>

      <label class="playground__field">
        Adapter
        <select v-model="adapterName">
          <option v-for="name in adapterNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <label class="playground__field">
        Theme
        <select v-model="theme">
          <option value="light">light</option>
          <option value="dark">dark</option>
          <option value="cyber">cyber · 未来科技</option>
        </select>
      </label>

      <label class="playground__field">
        Demo
        <select v-model="demoId">
          <option v-for="id in demoIds" :key="id" :value="id">{{ getDemo(id)?.title }} ({{ id }})</option>
        </select>
      </label>

      <button type="button" class="playground__toggle" @click="showSource = !showSource">
        {{ showSource ? '隐藏源码' : '查看源码' }}
      </button>
    </header>

    <main
      class="playground__body"
      :class="[`playground__body--${adapterName}`, { 'playground__body--full': isScreenDemo }]"
    >
      <!-- key 变化时整棵子树重建，避免旧适配器的 DOM 状态残留 -->
      <FbkProvider :key="`${adapterName}-${theme}`" :adapter="adapter" :theme="theme">
        <component :is="demo?.component" v-if="demo" />
      </FbkProvider>

      <pre v-if="showSource" class="playground__source"><code>{{ source }}</code></pre>
    </main>
  </div>
</template>
