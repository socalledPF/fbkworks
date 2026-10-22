<script setup lang="ts">
import { computed, ref } from 'vue'
import { FbkProvider } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import AdminLayout from './layout/AdminLayout.vue'
import LoginPage from './pages/LoginPage.vue'
import WorkbenchPage from './pages/WorkbenchPage.vue'
import OrdersPage from './pages/OrdersPage.vue'
import OrderDetailPage from './pages/OrderDetailPage.vue'
import UsersPage from './pages/UsersPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import ExceptionPage from './pages/ExceptionPage.vue'
import { route, segments } from './router'

/**
 * 后台管理系统 demo 的根组件。
 *
 * 只用 element-plus 一个适配器 —— 模拟真实项目的选择。
 */

const theme = ref<'light' | 'dark'>('light')
const collapsed = ref(false)
const user = ref<{ name: string; role: string } | null>(null)

/**
 * 主题切换交给 FbkProvider。
 *
 * 早期这里手动写 `data-fbk-theme` —— 结果是「一半生效」：
 * 令牌层（--fbk-*）变了，但 element-plus 需要的 `html.dark` 类没挂上，
 * 于是 --el-bg-color 仍是 #ffffff，表格在暗色下依然白底。
 *
 * FbkProvider 的 theme prop 会同时做两件事：
 *   1. 写 data-fbk-theme（令牌层）
 *   2. 调 adapter.theme.apply()（UI 库层，含 html.dark）
 * 绕过它只做第 1 步就会半吊子。
 */

/** 正常页面（异常页单独处理，因为它需要 kind prop） */
const normalPage = computed(() => {
  const [first, second] = segments.value
  if (!first) return WorkbenchPage
  if (first === 'orders') return second ? OrderDetailPage : OrdersPage
  if (first === 'users') return UsersPage
  if (first === 'settings') return SettingsPage
  return null
})

/** 未知路由与显式异常路由都走 ExceptionPage */
const exceptionKind = computed<'403' | '404' | '500'>(() => {
  const first = segments.value[0]
  if (first === '403') return '403'
  if (first === '500') return '500'
  return '404'
})

function onLogin(u: { name: string; role: string }) {
  user.value = u
}

function logout() {
  user.value = null
  location.hash = '/'
}
</script>

<template>
  <FbkProvider :adapter="elementPlusAdapter" :theme="theme">
    <LoginPage v-if="!user" @success="onLogin" />

    <AdminLayout
      v-else
      v-model:theme="theme"
      v-model:collapsed="collapsed"
      :user="user"
      @logout="logout"
    >
      <!-- 用 route 做 key，切换页面时整棵子树重建，避免残留状态 -->
      <component :is="normalPage" v-if="normalPage" :key="route" />
      <ExceptionPage v-else :key="route" :kind="exceptionKind" />
    </AdminLayout>
  </FbkProvider>
</template>
