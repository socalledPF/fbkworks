# 详情页

把「列表页已有的三态约定」延伸到详情页。

## 为什么需要它

`CrudPage` 把列表页的加载/空/错误变成了组件约定，但详情页没有对应物：

| 页面 | 手写三态代码 |
|---|---|
| 列表页（用 `CrudPage`） | **0 行** |
| 详情页（手写） | **5-8 行**，且每写一次重复一遍 |

后果不只是重复，还有**表现不一致**：有人用 `FbkResult`，有人用一行「加载中…」，
详情页的错误也不会走 `useReporter()` —— 监控里是个黑洞。

## 基础用法

```vue
<script setup lang="ts">
import { FbkDetailPage } from '@fbk/components/detail-page'
import type { DescriptionItem } from '@fbk/components/descriptions'

const items: DescriptionItem<Order>[] = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'amount', label: '金额', getValue: (row) => `¥${row.amount.toFixed(2)}` },
  { key: 'address', label: '地址', dataIndex: 'address', span: 2 },
]
</script>

<template>
  <FbkDetailPage
    :request="() => fetchOrder(id)"
    :items="items"
    :title="(data) => `订单 ${data.orderNo}`"
    :breadcrumbs="[{ text: '订单列表', to: '/orders' }, { text: '详情' }]"
    back
    @back="router.back()"
  >
    <!-- 业务特有区块 -->
    <template #extra="{ data }">
      <OrderTimeline :order="data" />
    </template>

    <template #actions>
      <button @click="edit">编辑</button>
    </template>
  </FbkDetailPage>
</template>
```

## 三态约定

| 状态 | 表现 | 说明 |
|---|---|---|
| 加载中 | 骨架 | 不用「加载中…」文字 —— 文字会闪 |
| 请求失败 | `Result status="error"` + 重试 | 错误要能自我恢复 |
| **返回 null** | `Result status="404"` | **不是错误**，是资源不存在 |
| 正常 | `Descriptions` + 插槽 | |

**`null` 与 `error` 的区别很重要**：

```ts
:request="() => fetchOrder(id)"
// 后端返回 404 / 空对象 → 返回 null  → 渲染「内容不存在」
// 网络失败 / 服务端 500  → throw    → 渲染「加载失败」+ 重试
```

把 404 显示成「加载失败」会让用户反复重试一个不存在的资源。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `request` | `() => Promise<T \| null>` | 取详情。`null` 视为 404 |
| `items` | `DescriptionItem<T>[]` | 字段描述，直接透传给 `Descriptions` |
| `title` | `string \| ((data) => string)` | 传函数时可用数据里的字段 |
| `subtitle` | `string` | |
| `breadcrumbs` | `BreadcrumbItem[]` | |
| `back` | `boolean \| (() => void)` | |
| `column` | `number \| { xs/sm/md/lg }` | 列数 |
| `groups` | `DescriptionGroup[]` | 分组 |
| `emptyText` | `string` | 字段为空时的占位 |
| `immediate` | `boolean` | 默认 `true` |

## Slots

| slot | 参数 | 用途 |
|---|---|---|
| `extra` | `{ data }` | 额外区块（时间线、关联列表） |
| `actions` | `{ data }` | 操作区 |
| `loading` | — | 覆盖加载态 |
| `error` | `{ error, retry }` | 覆盖错误态 |
| `field-${key}` | `{ data, value }` | 覆盖单个字段的渲染 |

## `useDetail` composable

需要完全自定义模板时用它，两者共用同一份实现：

```ts
import { useDetail } from '@fbk/components/detail-page'

const { data, loading, error, reload } = useDetail({
  fetcher: () => fetchOrder(id),
  immediate: true,
})
```

`id` 变化时自动重新请求：

```ts
import { useDetailWatch } from '@fbk/components/detail-page'

const { data } = useDetailWatch({
  fetcher: () => fetchOrder(id.value),
  watchSource: () => id.value,
})
```

> 为什么 `watch` 要显式传 `watchSource`：多数业务的 fetcher 是箭头函数
> （每次渲染都是新引用），自动 watch fetcher 会让行为不可预测。

## 错误上报

失败时自动走 `useReporter()`，`source: 'component'`，与 `ProTable` 同一出口。
业务方不需要手接：

```ts
app.use(createBusinessKit({
  adapter,
  onError: (e) => reporter.error(e),   // 详情页的错误也会到这里
}))
```

## 设计取舍

| 决策 | 理由 |
|---|---|
| `items` 复用 `DescriptionItem` | 两套字段描述会让用户困惑；`Descriptions` 能写的，详情页也应该能写 |
| 不内置编辑态 | 编辑用 `FormModal`，详情页只读 |
| 不内置 Tab 分组 | `groups` 已覆盖多数场景；复杂分页交给 `extra` |
| 不自动推断字段 | 从 TS 类型推断标签需要运行时类型信息，成本远超收益 |
