<script setup lang="ts">
import { defineComponent, h, onErrorCaptured, ref } from "vue"
import { FbkProTable } from "@fbkworks/components/pro-table"
import { FbkQueryForm } from "@fbkworks/components/query-form"
import { FbkCrudPage } from "@fbkworks/components/crud-page"
import { FbkChart } from "@fbkworks/chart-core"
import type { ProTableColumn } from "@fbkworks/components/pro-table"
import type { QueryField } from "@fbkworks/components/query-form"
import { orderStatusEnum, orders, type OrderRow } from "./data"

/**
 * 评审问题陈列页（临时 demo）。
 * 每个区块对应一条已核实的发现，编号与评审报告一致。
 * 想看 vant 的暗色问题：把地址改成 ?adapter=vant&theme=dark。
 */

const columns: ProTableColumn<OrderRow>[] = [
  { key: "orderNo", title: "订单号", dataIndex: "orderNo" },
  { key: "customer", title: "客户", dataIndex: "customer" },
  { key: "amount", title: "金额", dataIndex: "amount", valueType: "money", align: "right" },
  { key: "status", title: "状态", dataIndex: "status", valueType: "enum", valueEnum: orderStatusEnum },
]

const request = () => Promise.resolve({ list: orders.slice(0, 5), total: 48 })

/* ---------- P0-2：函数型 options ---------- */
const fnFields: QueryField[] = [
  { name: "province", label: "省份", type: "select", options: [{ label: "浙江", value: "zj" }] },
  {
    name: "city",
    label: "城市",
    type: "select",
    // 类型明确允许函数形式（query-form/types.ts:22-24），实现里没有解析
    options: () => [{ label: "杭州", value: "hz" }],
  },
]
const fnModel = ref<Record<string, unknown>>({})

/* 捕获渲染期抛错，把异常显示出来而不是让整页白屏 */
const CrashGuard = defineComponent({
  setup(_, { slots }) {
    const error = ref<string | null>(null)
    onErrorCaptured((e: any) => {
      error.value = String(e?.message ?? e)
      return false
    })
    return () =>
      error.value
        ? h("div", { class: "crash" }, ["渲染期抛错：", h("code", error.value)])
        : slots.default?.() ?? null
  },
})

/* ---------- P1：span 无效 ---------- */
const spanFields: QueryField[] = [
  { name: "a", label: "字段 A（span 2）", type: "input", span: 2 },
  { name: "b", label: "字段 B", type: "input" },
  { name: "c", label: "字段 C", type: "input" },
]
const spanModel = ref<Record<string, unknown>>({})

/* ---------- P1：CrudPage 没有 reload() ---------- */
const crudRef = ref<any>(null)
const reloadMsg = ref("还没点")
function tryReload() {
  try {
    // admin 的 OrdersPage/UsersPage 就是这么写的（4 处）
    crudRef.value?.reload()
    reloadMsg.value = "没抛错（说明 reload 存在）"
  } catch (e: any) {
    reloadMsg.value = "抛错：" + String(e?.message ?? e)
  }
}

/* ---------- 图表：系列被静默丢弃 ---------- */
const lineOption = {
  xAxis: { type: "category", data: ["一月", "二月", "三月"] },
  yAxis: { type: "value" },
  series: [{ type: "line", data: [12, 30, 22] }],
}
const scatterOption = {
  xAxis: { type: "category", data: ["一月", "二月", "三月"] },
  yAxis: { type: "value" },
  series: [{ type: "scatter", data: [12, 30, 22] }],
}

/* ---------- 图表：两份 loading 配置 ---------- */
const toggleLoading = ref(false)
</script>

<template>
<div class="bugs">
  <h1>评审问题陈列</h1>
  <p class="lead">每块对应一条已核实的发现。地址栏的 <code>adapter</code> / <code>theme</code> 参数会作用于整页。</p>

  <!-- P0-1 -->
  <section>
    <h2>P0-1 · 不传 selection 就没有选择列</h2>
    <p class="expect">左：省略 <code>:selection</code>（文档说这是默认开启）→ 没有勾选框、没有批量操作栏。
      右：显式 <code>:selection="{}"</code> → 勾选框和批量条都出来了。</p>
    <div class="pair">
      <div class="cell">
        <div class="tag bad">省略 selection</div>
        <FbkProTable :columns="columns" :request="request" row-key="orderNo" />
      </div>
      <div class="cell">
        <div class="tag good">显式传 selection</div>
        <FbkProTable :columns="columns" :request="request" row-key="orderNo" :selection="{}" />
      </div>
    </div>
  </section>

  <!-- P0-2 -->
  <section>
    <h2>P0-2 · 函数型 options 让查询区渲染崩溃</h2>
    <p class="expect">类型允许 <code>options: (values) =&gt; SelectOption[]</code>（联动用），
      但 QueryForm 只做了 <code>as SelectOption[]</code> 断言 → 适配器对函数调用 <code>.map</code> → TypeError。</p>
    <CrashGuard>
      <FbkQueryForm v-model="fnModel" :fields="fnFields" />
    </CrashGuard>
  </section>

  <!-- P1 span -->
  <section>
    <h2>P1 · <code>span</code> 全链静默无效</h2>
    <p class="expect">字段 A 写了 <code>span: 2</code>，三个适配器的 FormItem 都只声明不实现 → 与 B/C 同宽。</p>
    <FbkQueryForm v-model="spanModel" :fields="spanFields" />
  </section>

  <!-- P1 reload -->
  <section>
    <h2>P1 · CrudPage 没有 <code>reload()</code>（admin 里调了 4 次）</h2>
    <p class="expect">admin 的 OrdersPage/UsersPage 用 <code>crudRef.value?.reload()</code>。
      可选链只保护 null，对象非空时直接 TypeError。</p>
    <div class="row">
      <button class="fbk-demo-btn" @click="tryReload">调用 crudRef.value?.reload()</button>
      <code class="result">{{ reloadMsg }}</code>
    </div>
    <FbkCrudPage ref="crudRef" title="订单" :columns="columns" :request="request" row-key="orderNo" :selection="{}" />
  </section>

  <!-- 图表 -->
  <section>
    <h2>P1 · 未注册的图型被静默丢弃（默认只注册 4 种，类型却承诺 8 种）</h2>
    <p class="expect">左 line 正常；右 scatter <strong>有坐标轴、没有一个点</strong> —— 不抛错、不显示空态、
      <code>emit('error')</code> 不触发，只有一行 console 提示。</p>
    <div class="pair">
      <div class="cell"><div class="tag good">line</div><FbkChart :option="lineOption" height="200px" /></div>
      <div class="cell"><div class="tag bad">scatter</div><FbkChart :option="scatterOption" height="200px" /></div>
    </div>
  </section>

  <section>
    <h2>P1 · loading 遮罩两份配置，外观不一致</h2>
    <p class="expect">左：挂载时就是 <code>loading=true</code> → 走 applyOption 那份配置，<strong>60% 白纱、没有文案</strong>。
      右：挂载后点按钮切 <code>loading</code> → 走 watcher 那份，<strong>透明遮罩 + 「加载中」</strong>，
      且颜色是未解析的 <code>var(--fbk-color-primary)</code>（canvas 不认，转圈看不见）。</p>
    <div class="row"><button class="fbk-demo-btn" @click="toggleLoading = !toggleLoading">切换右侧 loading（当前 {{ toggleLoading }}）</button></div>
    <div class="pair">
      <div class="cell"><div class="tag bad">挂载即 loading</div><FbkChart :option="lineOption" :loading="true" height="200px" /></div>
      <div class="cell"><div class="tag">watcher 切 loading</div><FbkChart :option="lineOption" :loading="toggleLoading" height="200px" /></div>
    </div>
  </section>

  <section>
    <h2>P0-3 · vant 的暗色 / cyber（本页需 <code>?adapter=vant&amp;theme=dark</code>）</h2>
    <p class="expect">这一条用仓库现有 demo 看最干净：<code>#/query-form/basic?adapter=vant&amp;theme=dark</code>
      —— 页面底色变暗了，三个 <code>van-field</code> 仍是白底。原因是 <code>vant/src/theme.ts</code>
      的 apply() 不看 mode，把浅色变量写成 html 的行内样式，压掉了 vant 自己的
      <code>.van-theme-dark</code> 类规则。</p>
    <div class="crash">注意：本页在 <code>vant + dark</code> 下会卡死（未定位，既有 demo 全部正常），
      所以这里不再渲染表单，请用上面那条链接观察。</div>
  </section>
</div>
</template>

<style scoped>
.bugs { padding: 16px 20px 60px; max-width: 1180px; }
.bugs h1 { font-size: 18px; margin: 0 0 4px; }
.bugs .lead { color: var(--fbk-color-text-secondary); margin: 0 0 20px; font-size: 13px; }
.bugs section { border-top: 1px solid var(--fbk-color-border-light); padding: 16px 0 8px; }
.bugs h2 { font-size: 14px; margin: 0 0 6px; }
.bugs .expect { font-size: 12px; color: var(--fbk-color-text-secondary); margin: 0 0 10px; line-height: 1.7; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
.cell { border: 1px dashed var(--fbk-color-border); border-radius: 6px; padding: 8px; }
.tag { font-size: 11px; margin-bottom: 6px; color: var(--fbk-color-text-secondary); }
.tag.bad { color: #d93026; }
.tag.good { color: #0b7a3b; }
.row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.fbk-demo-btn { padding: 5px 10px; border-radius: 4px; border: 1px solid var(--fbk-color-border); background: var(--fbk-color-fill); cursor: pointer; }
.result { font-size: 12px; }
.crash { border: 1px solid #d93026; background: #fff1f0; color: #a8071a; padding: 10px; border-radius: 4px; font-size: 12px; }
</style>
