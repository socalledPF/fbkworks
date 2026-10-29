<script setup lang="ts">
import { computed } from 'vue'
import { isActive, navigate } from '../router'
// 样式就近引入：放在组件旁边，改动布局时不会忘记同步
import './layout.css'

/**
 * 后台布局壳。
 *
 * 这里**刻意不使用** @fbkworks/components 的组件 —— 布局壳属于「应用框架」，
 * 组件库的 PageContainer 是给「单个页面」用的，不是给「全局框架」用的。
 * 混用会让 PageContainer 承担它不该承担的职责。
 *
 * 但所有视觉都走设计令牌，与组件库保持同一套语言。
 */

export interface MenuItem {
  key: string
  label: string
  icon: string
  children?: MenuItem[]
}

defineProps<{
  theme: 'light' | 'dark'
  collapsed: boolean
  user: { name: string; role: string }
  hasDeletePermission: boolean
}>()

const emit = defineEmits<{
  'update:theme': [value: 'light' | 'dark']
  'update:collapsed': [value: boolean]
  logout: []
  'toggle-delete-permission': []
}>()

const menus: MenuItem[] = [
  { key: '/', label: '工作台', icon: '◈' },
  {
    key: '/orders',
    label: '交易管理',
    icon: '▤',
    children: [
      { key: '/orders', label: '订单列表', icon: '' },
      { key: '/users', label: '用户管理', icon: '' },
    ],
  },
  { key: '/settings', label: '系统设置', icon: '⚙' },
  { key: '/403', label: '无权限页', icon: '⊘' },
  { key: '/404', label: '异常页', icon: '⚠' },
]

/** 展开的父菜单 */
const openKeys = computed(() => {
  const out: string[] = []
  for (const m of menus) {
    if (m.children?.some((c) => isActive(c.key))) out.push(m.key)
  }
  return out
})
</script>

<template>
  <div class="admin-layout" :class="{ 'admin-layout--collapsed': collapsed }">
    <aside class="admin-sidebar">
      <div class="admin-sidebar__brand">
        <span class="admin-sidebar__logo">F</span>
        <span v-if="!collapsed" class="admin-sidebar__name">FBK Admin</span>
      </div>

      <nav class="admin-sidebar__nav">
        <template v-for="item in menus" :key="item.key">
          <!-- 有子菜单：渲染分组 -->
          <div v-if="item.children" class="admin-menu-group">
            <div class="admin-menu-group__label" :class="{ 'is-open': openKeys.includes(item.key) }">
              <span class="admin-menu__icon">{{ item.icon }}</span>
              <span v-if="!collapsed" class="admin-menu__text">{{ item.label }}</span>
            </div>
            <button
              v-for="child in item.children"
              :key="child.key"
              type="button"
              class="admin-menu admin-menu--child"
              :class="{ 'is-active': isActive(child.key) }"
              :title="collapsed ? child.label : undefined"
              @click="navigate(child.key)"
            >
              <span v-if="!collapsed" class="admin-menu__text">{{ child.label }}</span>
              <span v-else class="admin-menu__icon">·</span>
            </button>
          </div>

          <!-- 无子菜单 -->
          <button
            v-else
            type="button"
            class="admin-menu"
            :class="{ 'is-active': isActive(item.key) }"
            :title="collapsed ? item.label : undefined"
            @click="navigate(item.key)"
          >
            <span class="admin-menu__icon">{{ item.icon }}</span>
            <span v-if="!collapsed" class="admin-menu__text">{{ item.label }}</span>
          </button>
        </template>
      </nav>

      <div class="admin-sidebar__footer">
        <button
          type="button"
          class="admin-sidebar__collapse"
          :aria-label="collapsed ? '展开菜单' : '收起菜单'"
          @click="emit('update:collapsed', !collapsed)"
        >
          {{ collapsed ? '»' : '«' }}
        </button>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <button
            type="button"
            class="admin-topbar__icon-btn"
            aria-label="切换菜单"
            @click="emit('update:collapsed', !collapsed)"
          >
            ☰
          </button>
        </div>

        <div class="admin-topbar__right">
          <button
            type="button"
            class="admin-topbar__icon-btn"
            :aria-label="theme === 'light' ? '切换到暗色' : '切换到亮色'"
            @click="emit('update:theme', theme === 'light' ? 'dark' : 'light')"
          >
            {{ theme === 'light' ? '☾' : '☀' }}
          </button>

          <div class="admin-user">
            <span class="admin-user__avatar">{{ user.name.slice(0, 1) }}</span>
            <span class="admin-user__meta">
              <span class="admin-user__name">{{ user.name }}</span>
              <span class="admin-user__role">{{ user.role }}</span>
            </span>
          </div>

          <button
            type="button"
            class="admin-topbar__perm"
            :aria-pressed="hasDeletePermission"
            @click="emit('toggle-delete-permission')"
          >
            {{ hasDeletePermission ? '有删除权限' : '无删除权限' }}
          </button>

          <button type="button" class="admin-topbar__logout" @click="emit('logout')">退出</button>
        </div>
      </header>

      <main class="admin-content">
        <slot />
      </main>
    </div>
  </div>
</template>
