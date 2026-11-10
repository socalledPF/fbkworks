<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useAttrs, watch } from 'vue'
import { init, type ECharts } from 'echarts/core'
import { registerFbkCharts } from './register'
import { resolveOptionVars } from './color'
import { resolveChartTheme } from './theme'
import type { FbkChartOption } from './types'

/**
 * ECharts 容器组件。
 *
 * 职责边界（都是手写时最容易漏的）：
 *   · 生命周期：init / dispose，卸载时必须 dispose，否则实例泄漏
 *   · 尺寸变化：ResizeObserver 而非 window.resize —— 容器在 flex/grid 里
 *     变化时 window 不会触发 resize，图表会保持旧尺寸
 *   · 主题切换：监听 data-fbk-theme 变化并重新应用主题
 *   · 空态：没有数据时不该渲染一个空白坐标系
 */
defineOptions({ name: 'FbkChart', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** ECharts option。类型刻意放宽，避免 echarts 类型进入公开契约 */
    option: FbkChartOption
    /** 高度，数字按 px 处理 */
    height?: string | number
    /** 是否显示加载态 */
    loading?: boolean
    /** 是否自动应用 FBK 主题 */
    themed?: boolean
    /** 空数据提示。传空字符串关闭空态 */
    emptyText?: string
    /** 空数据判定：默认检查 option.series 是否为空 */
    isEmpty?: boolean
  }>(),
  {
    height: undefined,
    loading: false,
    themed: true,
    emptyText: '暂无数据',
    isEmpty: undefined,
  },
)

const emit = defineEmits<{
  ready: [chart: ECharts]
  click: [params: Record<string, any>]
  /** 尺寸变化（缩放后） */
  resize: [size: { width: number; height: number }]
  /**
   * 图表初始化或渲染失败。
   *
   * 不传时组件降级为空态，不抛到全局 —— 一个图表渲染失败
   * 不该让整页白屏。
   */
  error: [error: unknown]
}>()

const container = ref<HTMLDivElement>()
const chart = shallowRef<ECharts>()
/* 曾经有个 themeVersion ref 在这里，只写不读 —— 主题切换靠的是直接 create()，
   那个计数器从来没参与任何逻辑。删掉，免得下一个人以为它是那条链路的开关。 */

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会静默失效。
   attrs 落点是根 div：它既是 .fbk-chart（position: relative）的定位容器，
   也是 position: absolute; inset: 0 的 canvas 的父级 —— 外部 style 只有落在这里才会影响布局。 */
const attrs = useAttrs()

const style = computed(() => {
  const h = props.height
  if (h === undefined) return {}
  return { height: typeof h === 'number' ? `${h}px` : h }
})

/** 默认空态判定：series 为空或所有系列都没有 data */
const resolvedEmpty = computed(() => {
  if (props.isEmpty !== undefined) return props.isEmpty
  const series = props.option?.series
  if (!series) return true
  const list = Array.isArray(series) ? series : [series]
  if (!list.length) return true
  return list.every((s: any) => !s?.data || (Array.isArray(s.data) && s.data.length === 0))
})

function applyOption() {
  const instance = chart.value
  if (!instance) return

  try {
    /* 必须先解析 CSS 变量：ECharts 用 Canvas 绘制，不认 var(--x)，
       直接传会抛 "could not be parsed as a color" 并且图表不上色。 */
    const resolved = resolveOptionVars(props.option)
    /* 用 replaceMerge 而不是 notMerge:false。
       纯合并（notMerge:false）有两个实测后果：
         1. 系列变少时旧系列继续渲染 —— 用户筛掉一条线，画面上仍然留着它和它的旧数据；
         2. 新配置里没有 legend 时图例不会被移除（合并语义下「没给」=「别动」）。
       replaceMerge 只替换这两类组件、其余照旧合并，所以动画与其它状态都保住了。
       这也是那四个图表组件敢用「series.length > 1 ? legend : undefined」这种写法
       的前提 —— 否则去掉的那一半根本不生效。 */
    /* 重建实例（主题切换）后遮罩会跟着旧实例一起没了，而 props.loading 没变、
       watcher 不会触发 —— 结果是「loading=true 却看不到遮罩」，看起来像加载完了。 */
    if (props.loading) {
      instance.showLoading('default', { text: '', color: '#3b82f6', maskColor: 'rgba(255,255,255,0.6)' })
    }

    instance.setOption(resolved as any, {
      /* 只替换「可能整块消失」的组件类型。
         实测：series / legend / dataZoom 在新 option 里被删掉后，
         纯合并会把它们留在实例上（折线↔饼这类换图型会留下空坐标系与残留缩放条）。
         xAxis / yAxis / grid 不在这里 —— 它们的增减在合并语义下能正确归一
         （实测轴互换后 axisLabel 的 width/overflow 被丢弃、axisLine.show 归一），
         换成 replaceMerge 反而会让坐标轴动画每帧重建。 */
      /* 只能点名**已注册**的组件。register.ts 里没有 geo，
         点名它会直接让 echarts 崩掉（大屏整页图表消失，CI 的视觉回归当场红）——
         没注册的组件本来也不可能出现在 option 里，不必也不该列进来。 */
      replaceMerge: ['series', 'legend'],
      lazyUpdate: false,
    })
  } catch (err) {
    /* setOption 抛错通常是配置写错（渐变色的非法值、series 结构不对）。
       捕获后上报，图表保留上一帧而不是整页崩。 */
    emit('error', err)
  }
}

function create() {
  const el = container.value
  if (!el) return

  /* 关键：ECharts 在 init 时会读取容器的 clientWidth/clientHeight 并**固定**下来。
     如果此时容器高度是 0（flex / grid 布局里常见），它会写下
     `height: 0px` 的行内样式，之后 resize() 也无法恢复 —— 图表永久空白。

     所以：容器没有高度时先不 init，等 ResizeObserver 报出有效尺寸再建。
     这是大屏里"图表全空白"的真正原因。 */
  if (!el.clientWidth || !el.clientHeight) {
    pendingCreate = true
    return
  }
  pendingCreate = false

  // 卸载旧实例（主题切换时 theme 无法热替换，只能重建）
  chart.value?.dispose()

  const theme = props.themed ? resolveChartTheme()._echartsTheme : undefined

  /* echarts.init 会抛错（容器不是 DOM、已初始化过、canvas 创建失败等）。
     之前没有保护：一个图表初始化失败会冒泡到全局，整页白屏。
     现在捕获后走 onError 上报，组件降级为空态而不是崩掉。 */
  let instance
  try {
    instance = init(el, theme)
  } catch (err) {
    emit('error', err)
    return
  }
  chart.value = instance

  instance.on('click', (params: any) => emit('click', params))
  applyOption()
  emit('ready', instance)
}

/** 尺寸为 0 时挂起创建，等 ResizeObserver 通知 */
let pendingCreate = false

function resize() {
  /* 之前因为尺寸为 0 而挂起的创建，在这里补上 */
  if (pendingCreate) {
    create()
    return
  }
  const instance = chart.value
  if (!instance || !container.value) return
  instance.resize()
  const rect = container.value.getBoundingClientRect()
  emit('resize', { width: rect.width, height: rect.height })
}

let observer: ResizeObserver | null = null

onMounted(async () => {
  registerFbkCharts()
  create()

  if (typeof ResizeObserver !== 'undefined' && container.value) {
    /* 用 ResizeObserver 而不是 window.resize：
       图表在 flex / grid 容器里时，容器尺寸变化不会触发 window.resize，
       图表会保持旧尺寸直到窗口变化 —— 这是"图表不跟随布局"的常见原因。 */
    observer = new ResizeObserver(() => resize())
    observer.observe(container.value)
  }

  /* 兜底：ResizeObserver 在元素尺寸从 0 变为非 0 时**必然**会触发一次，
     但某些浏览器（或 jsdom）不保证。这里再补两帧检查，
     确保挂起的创建一定会被执行。 */
  const ensure = (attempt = 0) => {
    if (!pendingCreate) return
    if (attempt > 10) return
    if (container.value?.clientHeight) {
      create()
    } else {
      requestAnimationFrame(() => ensure(attempt + 1))
    }
  }
  requestAnimationFrame(() => ensure())
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart.value?.dispose()
  chart.value = undefined
})

/* option 变化时更新。deep 是必须的：
   业务侧常见写法是修改 series[0].data 而不换整个对象 */
watch(() => props.option, applyOption, { deep: true })

watch(
  () => props.loading,
  (loading) => {
    const instance = chart.value
    if (!instance) return
    if (loading) {
      instance.showLoading('default', {
        text: '加载中',
        color: 'var(--fbk-color-primary)',
        textColor: 'var(--fbk-color-text-secondary)',
        maskColor: 'transparent',
      })
    } else {
      instance.hideLoading()
    }
  },
)

/* 主题切换：监听根元素的 data-fbk-theme 属性 */
let themeObserver: MutationObserver | null = null

onMounted(() => {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
  themeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      /* 只认 data-fbk-theme。
         以前连 'class' 一起监听，于是 <html> 上任何 class 变化（字体、暗色兜底、
         甚至别的库加的一个调试类）都会 dispose + init 一次：
           · 外部通过 getInstance() 拿到的句柄立刻变成已销毁实例
           · loading 遮罩与进行中的动画被重置
         主题契约就是 data-fbk-theme（见 adapter-core/plugin.ts），class 不在契约里。 */
      if (m.attributeName === 'data-fbk-theme') {
        // 主题只能在 init 时指定，所以重建实例
        create()
        break
      }
    }
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-fbk-theme'],
  })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  themeObserver = null
})

defineExpose({
  /** 底层 ECharts 实例，用于调用 dispatchAction 等高级能力 */
  getInstance: () => chart.value,
  resize,
})
</script>

<template>
  <div class="fbk-chart" v-bind="attrs" :style="style">
    <div
      v-show="!resolvedEmpty || loading"
      ref="container"
      class="fbk-chart__canvas"
      :class="{ 'fbk-chart__canvas--loading': loading }"
    />
    <div v-if="resolvedEmpty && !loading && emptyText" class="fbk-chart__empty">
      {{ emptyText }}
    </div>
  </div>
</template>
