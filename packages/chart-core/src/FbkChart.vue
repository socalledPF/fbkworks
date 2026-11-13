<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useAttrs, watch } from 'vue'
import { init, type ECharts } from 'echarts/core'
import { registerFbkCharts } from './register'
import { resolveOptionVars } from './color'
import { resolveChartTheme } from './theme'
import type { FbkChartOption } from './types'

/**
 * option 里「可能整块出现 / 消失」的组件类型。
 *
 * 用来判断一次更新是**形状收缩**（某类组件整个不见了）还是**形状不变**（只换数据/系列）。
 * 只有前者需要放弃合并、整块重设 —— 见 applyOption 里的策略说明。
 *
 * 不含 series / legend：这两个用 replaceMerge 就能精确处理（系列变少、图例该消失），
 * 混进来只会让「单系列」这类正常变化被误判成形状收缩，白丢一次动画。
 * 也不含未注册的组件（register.ts 里没有 geo）：它们不可能出现在 option 里。
 */
const SHAPE_COMPONENT_KEYS = [
  'dataZoom',
  'visualMap',
  'xAxis',
  'yAxis',
  'grid',
  'tooltip',
  'polar',
  'radar',
  'angleAxis',
  'radiusAxis',
  'timeline',
  'graphic',
  'dataset',
  'title',
] as const

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

/**
 * 上一次更新之后，实例上存在哪些组件类型。
 *
 * 记账很简单：**永远等于上一次的 next**。因为只要 next 少了一类，
 * vanished 就成立、就走 notMerge 把实例清空重建 —— 也就是说
 * 「实例上有、但这次没给」这个状态根本不会留到下一次。
 * （曾经写成「合并后记并集」，那是不可达的分支：能出现并集差异的情形
 * 恰好就是 vanished 成立的情形。）
 */
let liveComponentKeys: Set<string> | undefined

function applyOption() {
  const instance = chart.value
  if (!instance) return

  try {
    /* 必须先解析 CSS 变量：ECharts 用 Canvas 绘制，不认 var(--x)，
       直接传会抛 "could not be parsed as a color" 并且图表不上色。 */
    const resolved = resolveOptionVars(props.option)

    /* ---------- 合并策略：形状感知 ---------- */
    const nextKeys = new Set<string>(
      SHAPE_COMPONENT_KEYS.filter(
        (key) => (resolved as Record<string, unknown> | undefined)?.[key] !== undefined,
      ),
    )
    /* 「某类组件整个消失」是合并语义处理不了的情况：
       新 option 里没有 dataZoom，合并会把它当成「别动」，于是旧缩放条永远留着
       （dz-demo.html 的 A 面板就是这个现象的对照演示）。

       为什么不在 replaceMerge 里直接点名 dataZoom：
       在 echarts 层实测它是正常的（SSR 里残留能清成 0），但在**大屏页面**里点名后
       整页不渲染（CI 视觉回归 5 条 FAIL、本地 verify-charts 复现，回退即全绿），
       根因未定位。所以这里绕开它：形状收缩的那一次改用 notMerge 整块重设，
       代价只是这一次丢动画 —— 而形状收缩本来就是「换图型」，动画本来也要重来。 */
    const vanished = liveComponentKeys
      ? [...liveComponentKeys].some((key) => !nextKeys.has(key))
      : false

    /* 重建实例（主题切换）后遮罩会跟着旧实例一起没了，而 props.loading 没变、
       watcher 不会触发 —— 结果是「loading=true 却看不到遮罩」，看起来像加载完了。 */
    if (props.loading) {
      instance.showLoading('default', { text: '', color: '#3b82f6', maskColor: 'rgba(255,255,255,0.6)' })
    }

    instance.setOption(
      resolved as any,
      vanished
        ? { notMerge: true, lazyUpdate: false }
        : {
            /* 形状不变时走 replaceMerge：它精确处理「系列变少」与「图例该消失」，
               其余组件照旧合并，因此动画和缩放位置都不会被重置。
               （纯合并 notMerge:false 做不到这两件事：系列会残留、图例移不掉。） */
            replaceMerge: ['series', 'legend'],
            lazyUpdate: false,
          },
    )

    liveComponentKeys = nextKeys
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
  /* 新实例是空的，形状记账必须清零 —— 否则第一次 applyOption 会拿旧实例的并集
     去判断「有没有组件消失」，可能凭空走一次 notMerge。 */
  liveComponentKeys = undefined

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
