<script setup lang="ts">
import { ElButton } from 'element-plus'

/**
 * 源码抽屉。
 *
 * 从「内容区下方直接铺开」改为右侧抽屉：demo 内容比源码重要，
 * 源码是「需要时查一下」，不该把 demo 挤到看不见。
 */
defineProps<{
  open: boolean
  title: string
  source: string
}>()

const emit = defineEmits<{
  close: []
  copy: []
}>()
</script>

<template>
  <div class="pg-drawer" :class="{ 'is-open': open }" :aria-hidden="!open">
    <div class="pg-drawer__panel">
      <header class="pg-drawer__header">
        <div class="pg-drawer__heading">
          <span class="pg-drawer__title">源码</span>
          <span class="pg-drawer__sub">{{ title }}</span>
        </div>
        <div class="pg-drawer__actions">
          <el-button size="small" @click="emit('copy')">复制</el-button>
          <el-button size="small" text @click="emit('close')">关闭</el-button>
        </div>
      </header>

      <pre class="pg-drawer__code"><code>{{ source }}</code></pre>
    </div>

    <div class="pg-drawer__mask" @click="emit('close')" />
  </div>
</template>
