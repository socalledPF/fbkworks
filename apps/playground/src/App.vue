<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FbkProvider } from '@fbk/adapter-core'
import type { ThemeMode } from '@fbk/adapter-core'
import { demosByGroup, getDemo, getDemoSource } from '@fbk/demos'
import { adapters, adapterNames, type AdapterName } from './adapters'
/*
 * 顶部控件直接用 element-plus 的组件。
 *
 * 显式 import 而不是全局注册：全局注册会把整个 element-plus 打进产物，
 * 而 playground 只需要这几个控件。同时显式 import 也让「这里用了外部库」
 * 这件事在代码里一目了然。
 */
import { ElOption, ElSelect, ElSwitch } from 'element-plus'
import PlaygroundSidebar from './PlaygroundSidebar.vue'
import PlaygroundSourceDrawer from './PlaygroundSourceDrawer.vue'

/**
 * Playground 外壳。
 *
 * 设计要点（见 docs/design/2026-10-23-playground-redesign.md）：
 *   · 侧边栏显式列出所有 demo，而不是塞进一个下拉框
 *   · 顶部控件直接用 element-plus —— playground 是**消费方应用**，
 *     不受组件库的零依赖约束，没有理由手写 <select> 再模仿 UI 库
 *   · 源码放右侧抽屉，不挤占 demo 区域
 *   · 状态同步到 URL，可直达、可分享
 */

const adapterName = ref<AdapterName>('element-plus')
const theme = ref<ThemeMode>('light')
const demoId = ref(demosByGroup[0]!.items[0]!.id)
const showSource = ref(false)
const sidebarOpen = ref(false)

const adapter = computed(() => adapters[adapterName.value])
const demo = computed(() => getDemo(demoId.value))
const source = computed(() => getDemoSource(demoId.value))

/* 大屏 demo 按 1920×1080 设计，需要全屏宽度，否则会被裁切且不居中 */
const isScreenDemo = computed(() => demoId.value.startsWith('screen/'))

// ---------- URL 同步 ----------

function readFromUrl() {
  const hash = location.hash.replace(/^#\/?/, '')
  const [path, query] = hash.split('?')
  if (path && getDemo(path)) demoId.value = path

  const q = new URLSearchParams(query ?? '')
  const a = q.get('adapter')
  const t = q.get('theme')
  if (a && adapterNames.includes(a as AdapterName)) adapterName.value = a as AdapterName
  if (t === 'light' || t === 'dark' || t === 'cyber') theme.value = t
}

function writeToUrl() {
  const q = new URLSearchParams({ adapter: adapterName.value, theme: theme.value })
  const next = `#/${demoId.value}?${q}`
  if (location.hash !== next) {
    // replaceState 而不是 pushState：切换 demo 不该在历史里堆几十条
    history.replaceState(null, '', next)
  }
}

/** Esc 关闭源码抽屉 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showSource.value = false
}

onMounted(() => {
  readFromUrl()
  writeToUrl()
  window.addEventListener('hashchange', readFromUrl)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', readFromUrl)
  window.removeEventListener('keydown', onKeydown)
})

watch([demoId, adapterName, theme], writeToUrl)

function selectDemo(id: string) {
  demoId.value = id
  sidebarOpen.value = false
}

async function copySource() {
  if (!source.value) return
  try {
    await navigator.clipboard.writeText(source.value)
  } catch {
    /* 非 HTTPS 环境下 clipboard 不可用，静默失败 */
  }
}
</script>

<template>
  <div class="pg" :class="{ 'pg--sidebar-open': sidebarOpen }">
    <PlaygroundSidebar
      :current="demoId"
      :open="sidebarOpen"
      @select="selectDemo"
      @close="sidebarOpen = false"
    />

    <div class="pg__main">
      <!-- 顶栏：当前在哪 + 全局开关。控件用 element-plus -->
      <header class="pg__topbar">
        <div class="pg__topbar-left">
          <button
            type="button"
            class="pg__icon-btn pg__icon-btn--menu"
            aria-label="打开菜单"
            @click="sidebarOpen = true"
          >
            ☰
          </button>
          <div class="pg__heading">
            <h1 class="pg__title">{{ demo?.title ?? '未选择' }}</h1>
            <span v-if="demo" class="pg__badge">{{ demo.group }}</span>
          </div>
        </div>

        <div class="pg__topbar-right">
          <div class="pg__switch">
            <span class="pg__switch-label">源码</span>
            <el-switch v-model="showSource" aria-label="查看源码" />
          </div>

          <el-select v-model="adapterName" style="width: 150px" aria-label="适配器">
            <el-option v-for="name in adapterNames" :key="name" :label="name" :value="name" />
          </el-select>

          <el-select v-model="theme" style="width: 130px" aria-label="主题">
            <el-option label="亮色" value="light" />
            <el-option label="暗色" value="dark" />
            <el-option label="科技风" value="cyber" />
          </el-select>
        </div>
      </header>

      <!-- Demo 说明条：让人知道该看什么 -->
      <div v-if="demo?.description" class="pg__desc">
        <span class="pg__desc-text">{{ demo.description }}</span>
      </div>

      <main class="pg__body" :class="{ 'pg__body--full': isScreenDemo }">
        <FbkProvider :key="`${adapterName}-${theme}`" :adapter="adapter" :theme="theme">
          <component :is="demo?.component" v-if="demo" />
        </FbkProvider>
      </main>
    </div>

    <PlaygroundSourceDrawer
      :open="showSource"
      :title="demo?.title ?? ''"
      :source="source ?? ''"
      @close="showSource = false"
      @copy="copySource"
    />
  </div>
</template>
