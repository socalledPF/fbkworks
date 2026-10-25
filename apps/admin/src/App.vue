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

/**
 * 可观测性演示。
 *
 * 真实项目里这两个钩子会接 Sentry / 阿里云 ARMS / 自建上报。
 * 这里打到 console，用来验证四类事件都能收到。
 */
const telemetryLog = ref<Array<{ kind: string; text: string }>>([])

function pushLog(kind: string, text: string) {
  telemetryLog.value.unshift({ kind, text })
  // 只留最近 30 条，避免面板无限增长
  if (telemetryLog.value.length > 30) telemetryLog.value.pop()
  // eslint-disable-next-line no-console
  console.log(`[telemetry] ${kind}`, text)
}

/**
 * 当前用户的权限点。
 *
 * 真实项目里来自登录接口。这里做成可切换，用来演示
 * 「权限变化 → 按钮实时出现/消失」。
 */
const permissions = ref<string[]>([
  'order:read',
  'order:edit',
  'order:delete',
  'user:read',
])

const permissionHooks = {
  permissions: () => permissions.value,
}

function toggleDeletePermission() {
  const has = permissions.value.includes('order:delete')
  permissions.value = has
    ? permissions.value.filter((p) => p !== 'order:delete')
    : [...permissions.value, 'order:delete']
}

const reporterHooks = {
  onError: (e: any) => pushLog('error', `${e.source}/${e.component ?? '-'}: ${e.message}`),
  onTelemetry: (e: any) =>
    pushLog(
      'telemetry',
      `${e.name} ${e.success ? '✓' : '✗'}${e.duration !== undefined ? ` ${e.duration}ms` : ''}`,
    ),
}
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
  <FbkProvider :adapter="elementPlusAdapter" :theme="theme" v-bind="{ ...reporterHooks, ...permissionHooks }">
    <LoginPage v-if="!user" @success="onLogin" />

    <AdminLayout
      v-else
      v-model:theme="theme"
      v-model:collapsed="collapsed"
      :user="user"
      :has-delete-permission="permissions.includes('order:delete')"
      @logout="logout"
      @toggle-delete-permission="toggleDeletePermission"
    >
      <!-- 用 route 做 key，切换页面时整棵子树重建，避免残留状态 -->
      <component :is="normalPage" v-if="normalPage" :key="route" />
      <ExceptionPage v-else :key="route" :kind="exceptionKind" />

      <!-- 上报事件面板：验证 onError / onTelemetry 真的能收到 -->
      <aside class="admin-telemetry" aria-live="polite">
        <div class="admin-telemetry__head">
          <span>上报事件</span>
          <button type="button" class="admin-telemetry__clear" @click="telemetryLog = []">
            清空
          </button>
        </div>
        <ul v-if="telemetryLog.length" class="admin-telemetry__list">
          <li v-for="(item, i) in telemetryLog.slice(0, 8)" :key="i" :data-kind="item.kind">
            {{ item.text }}
          </li>
        </ul>
        <p v-else class="admin-telemetry__empty">暂无事件（切换页面或筛选会触发请求）</p>
      </aside>
    </AdminLayout>
  </FbkProvider>
</template>
