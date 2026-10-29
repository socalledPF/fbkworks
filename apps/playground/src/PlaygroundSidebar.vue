<script setup lang="ts">
import { computed, ref } from 'vue'
import { demosByGroup } from '@fbkworks/demos'
import { ElInput } from 'element-plus'

/**
 * Demo 导航侧边栏。
 *
 * 用显式列表而不是下拉框：14 个 demo 摊开能一眼看全，
 * 分组后还能建立「这个库有哪些能力」的心智模型。
 */
defineProps<{
  current: string
  /** 窄屏时作为抽屉滑出 */
  open: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()

const keyword = ref('')

/** 按关键字过滤。命中分组名时保留整组，命中项名时只留匹配项 */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return demosByGroup

  return demosByGroup
    .map((g) => {
      const groupHit = g.group.toLowerCase().includes(kw)
      const items = groupHit
        ? g.items
        : g.items.filter(
            (item) =>
              item.title.toLowerCase().includes(kw) || item.id.toLowerCase().includes(kw),
          )
      return { ...g, items }
    })
    .filter((g) => g.items.length > 0)
})

const total = computed(() => filtered.value.reduce((n, g) => n + g.items.length, 0))
</script>

<template>
  <aside class="pg-sidebar" :class="{ 'is-open': open }">
    <div class="pg-sidebar__brand">
      <span class="pg-sidebar__logo">F</span>
      <div class="pg-sidebar__brand-text">
        <strong class="pg-sidebar__name">FBK Playground</strong>
        <span class="pg-sidebar__sub">组件评审台</span>
      </div>
      <button
        type="button"
        class="pg-sidebar__close"
        aria-label="关闭菜单"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="pg-sidebar__search">
      <el-input v-model="keyword" placeholder="搜索组件或 demo" clearable size="default">
        <template #prefix>
          <span class="pg-sidebar__search-icon">⌕</span>
        </template>
      </el-input>
    </div>

    <nav class="pg-sidebar__nav">
      <div v-for="group in filtered" :key="group.group" class="pg-sidebar__group">
        <div class="pg-sidebar__group-title">{{ group.group }}</div>
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          class="pg-sidebar__item"
          :class="{ 'is-active': item.id === current }"
          @click="emit('select', item.id)"
        >
          <span class="pg-sidebar__item-title">{{ item.title }}</span>
          <!-- 后缀只在非 basic 时显示：全是 basic 等于没有信息 -->
          <code v-if="item.id.split('/')[1] !== 'basic'" class="pg-sidebar__item-id">
            {{ item.id.split('/')[1] }}
          </code>
        </button>
      </div>

      <p v-if="!total" class="pg-sidebar__empty">没有匹配的 demo</p>
    </nav>

    <div class="pg-sidebar__footer">
      共 {{ total }} 个 demo
    </div>
  </aside>

  <!-- 遮罩：窄屏抽屉打开时点击关闭 -->
  <div v-if="open" class="pg-sidebar__mask" @click="emit('close')" />
</template>
