# 详情抽屉

点列表的一行 → 右侧滑出详情。**列表的页码、筛选、滚动位置都还在。**

## 为什么需要它

详情有两个入口，代价不一样：

| 入口 | 列表上下文 | 回退成本 | 适合什么 |
|---|---|---|---|
| 跳整页 | 丢失（回来要重新定位） | 高 | 字段多、要分享链接、要独立权限 |
| 抽屉 | **保留** | 低（Esc / 点遮罩） | 看一眼就走、连续核对多条 |

抽屉不是「整页的廉价版」：字段渲染与 `FbkDetailPage` **是同一套** —— 同一份 `items`、
同一批 `field-${key}` 插槽，内部真的把 `FbkDetailPage` 装进抽屉。所以同一份数据在页面和
抽屉里不会长得不一样，也不需要两处对齐。

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FbkProTable } from '@fbkworks/components/pro-table'
import { FbkDetailDrawer } from '@fbkworks/components/detail-drawer'
import type { DescriptionItem } from '@fbkworks/components/descriptions'

const show = ref(false)
const current = ref<OrderRow | null>(null)

const detailItems: DescriptionItem<OrderDetail>[] = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'amount', label: '金额', dataIndex: 'amount' },
  { key: 'address', label: '收货地址', dataIndex: 'address', span: 2 },
]

function openDetail(row: OrderRow) {
  // 业务侧的真实顺序：先定行，再打开。抽屉每次打开都会重新请求。
  current.value = row
  show.value = true
}

/** 返回 null 表示资源不存在（渲染 404，不是空白） */
async function fetchDetail(): Promise<OrderDetail | null> {
  const row = current.value
  return row ? await api.getOrderDetail(row.id) : null
}
</script>

<template>
  <FbkProTable :columns="columns" :request="queryOrders" row-key="id" @row-click="openDetail" />

  <FbkDetailDrawer
    v-model:show="show"
    :request="fetchDetail"
    :items="detailItems"
    :title="(data: OrderDetail) => `订单 ${data.orderNo}`"
    @expand="(data) => router.push(`/orders/${data?.id}`)"
  >
    <template #field-amount="{ value }">¥{{ Number(value).toFixed(2) }}</template>
    <template #extra="{ data }"><OrderTimeline :order="data" /></template>
  </FbkDetailDrawer>
</template>
```

## 三态与 DetailPage 一致

| 状态 | 表现 | 说明 |
|---|---|---|
| 加载中 | 骨架 | 不用「加载中…」文字，文字会闪 |
| 请求失败 | `Result status="error"` + 重试 | 错误要能自我恢复 |
| **返回 null** | `Result status="404"` | **不是错误**，是资源不存在 |

`show` 由 `false` 变 `true` 时会**重新请求** —— 重新打开拿到的是最新数据。
同一个打开周期内换 `request` 不会重新请求（与 `DetailPage` 一致，需要时用暴露的 `reload()`）。

## Props

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `false` | 显隐，支持 `v-model:show`。受控，组件自己不翻转 |
| `request` | `() => Promise<T \| null>` | — | 取详情。返回 `null` 视为资源不存在 |
| `items` | `DescriptionItem<T>[]` | — | 字段描述，直接透传给 `Descriptions` |
| `title` | `string \| ((data) => string)` | — | 传函数时可用数据里的字段 |
| `width` | `string \| number` | `480` | 桌面宽度。移动端一律铺满，忽略此值 |
| `closeOnClickModal` | `boolean` | `true` | 点遮罩是否关闭 |
| `showClose` | `boolean` | `true` | 是否显示标题栏关闭控件 |
| `expandText` | `string` | `'展开为整页'` | 「展开」按钮文案 |
| `showExpand` | `boolean` | `true` | 没有整页可去时关掉它 |
| `column` | `number \| {xs,sm,md,lg}` | `1` | 列数。抽屉窄，默认 1 列（`DetailPage` 是 2 列） |
| `groups` | `DescriptionGroup[]` | — | 分组定义 |
| `emptyText` | `string` | — | 字段为空时的占位 |
| `bordered` | `boolean` | — | 是否显示边框 |
| `direction` | `'horizontal' \| 'vertical'` | — | 标签与值的排布方向 |
| `size` | `Size` | — | 尺寸 |

`column` / `groups` / `emptyText` / `bordered` / `direction` / `size` 都是透传给
`FbkDetailPage` → `FbkDescriptions` 的，语义以 [Descriptions](/components/descriptions) 为准。

## Slots

与 `DetailPage` 完全一致（类型就是 `DetailPageSlots`）：

| slot | 参数 | 用途 |
|---|---|---|
| `extra` | `{ data }` | 额外区块（时间线、关联列表） |
| `actions` | `{ data }` | 操作区 |
| `loading` | — | 覆盖加载态 |
| `error` | `{ error, retry }` | 覆盖错误态 |
| `field-${key}` | `{ data, value }` | 覆盖单个字段的渲染 |

## Events

| 事件 | 参数 | 说明 |
|---|---|---|
| `update:show` | `(show: boolean)` | 配合 `v-model:show` |
| `close` | — | 抽屉关闭（点关闭控件、点遮罩，或调用方自己改 `show`，都会发） |
| `expand` | `(data: T \| null)` | 请求「展开为整页」，payload 是当前数据。**导航由业务方自己做** |
| `load` | `(data: T)` | 详情加载成功 |
| `error` | `(error: unknown)` | 请求失败（同时也走 `useReporter()`） |

## Expose

| 成员 | 类型 | 说明 |
|---|---|---|
| `data` | `T \| null` | 当前详情数据（未加载或 404 时为 `null`） |
| `reload` | `() => Promise<void>` | 重新请求 |
| `close` | `() => void` | 关闭，等价于 `emit('update:show', false)` |

## 移动端

`≤ 639px` 时抽屉改为**底部全屏**，`width` 被忽略（≥640 才算桌面）。
断点值与仓库 CSS 的 `@media (max-width: 639px)` 对齐。

## 依赖可选原语 `Drawer`

`FbkDetailDrawer` 通过 `requirePrimitive(adapter, 'Drawer', …)` 取抽屉容器。
`Drawer` 是**可选原语**：适配器可以只提供弹层、不提供抽屉。缺了它不是静默失效，而是立刻抛错：

```
[fbk] 适配器「xxx」没有提供 Drawer 原语，该组件不可用。
```

所以用这个组件的应用，要对**自定义适配器**提出 `Drawer` 要求；官方三个适配器
（element-plus / vant / naive-ui）都已实现。

## 设计取舍

| 决策 | 理由 |
|---|---|
| 不内置请求库 | `request` 由调用方注入，与 `useDetail` 同一契约 |
| 不做路由跳转 | 「展开为整页」只发 `expand` 事件 —— 库不该假设 SPA 结构 |
| 不塞进 `CrudPage` | 与它是 slot 组合关系，`CrudPage` 的 props 与行为零变化 |
| 桌面默认固定 `480px` | 用百分比会让字段换行位置随视口漂移（648px 与 640px 下同一行长相不该由视口决定） |
