<script setup lang="ts">
import { computed, ref } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { FbkProvider } from '@fbkworks/adapter-core'
import type { ThemeMode } from '@fbkworks/adapter-core'
import { adapters, adapterNames, type AdapterName } from './adapters'

const adapterName = ref<AdapterName>('element-plus')
const theme = ref<ThemeMode>('light')
const adapter = computed(() => adapters[adapterName.value])

/**
 * 全站包一层 FbkProvider：
 * - 组件示例需要适配器才能渲染；
 * - naive-ui 是 provider 型主题，必须由 FbkProvider 注入，CSS 变量对它无效。
 * `:key` 让切换适配器时整棵子树重建，避免旧适配器的 DOM 状态残留。
 */
</script>

<template>
  <FbkProvider :key="`${adapterName}-${theme}`" :adapter="adapter" :theme="theme">
    <DefaultTheme.Layout>
      <template #layout-top>
        <div class="fbk-docs-switcher">
          <span class="fbk-docs-switcher__label">适配器</span>
          <select v-model="adapterName" class="fbk-docs-switcher__select">
            <option v-for="name in adapterNames" :key="name" :value="name">{{ name }}</option>
          </select>

          <span class="fbk-docs-switcher__label">主题</span>
          <select v-model="theme" class="fbk-docs-switcher__select">
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </div>
      </template>
    </DefaultTheme.Layout>
  </FbkProvider>
</template>
