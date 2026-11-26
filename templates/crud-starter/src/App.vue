<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { FbkProvider } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
import ProductsPage from './pages/ProductsPage.vue'
import ProductsDetailPage from './pages/ProductsDetailPage.vue'

/**
 * 根组件：FbkProvider（接哪个 UI 库）+ 40 行 hash 路由。
 *
 * 为什么手写路由而不是引 vue-router：组件库把 vue-router 列为第一类禁止依赖，
 * 而模板要能在「只装 @fbkworks/*」的前提下跑起来。真实项目该用 vue-router ——
 * 那是**应用层**的选择，替换这一个文件即可。
 */
const route = ref(window.location.hash.slice(1) || '/')

function onHashChange() {
  route.value = window.location.hash.slice(1) || '/'
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))

/** /detail/12 → 12；其它情况为 null（渲染列表页） */
const detailId = computed(() => {
  const match = /^\/detail\/(\d+)$/.exec(route.value)
  return match ? Number(match[1]) : null
})
</script>

<template>
  <FbkProvider :adapter="elementPlusAdapter" theme="light">
    <!-- 用 route 做 key：切页时整棵子树重建，不残留上一页的翻页/筛选状态 -->
    <ProductsDetailPage v-if="detailId !== null" :id="detailId" :key="route" />
    <ProductsPage v-else :key="route" />
  </FbkProvider>
</template>
