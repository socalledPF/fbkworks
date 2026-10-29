# 快速开始

## 安装

业务应用只安装自己需要的适配器。**不要三个都装**——运行时适配器的原语表是静态对象，Rollup 摇不掉未使用的属性。

::: code-group

```bash [element-plus 桌面端]
pnpm add @fbkworks/components @fbkworks/adapter-element-plus
pnpm add -D element-plus
```

```bash [vant4 移动端]
pnpm add @fbkworks/components @fbkworks/adapter-vant
pnpm add -D vant
```

```bash [naive-ui 桌面端]
pnpm add @fbkworks/components @fbkworks/adapter-naive-ui
pnpm add -D naive-ui
```

:::

## 注入适配器

```ts
// main.ts
import { createApp } from 'vue'
import { createBusinessKit } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
import App from './App.vue'

import '@fbkworks/tokens/css'
import '@fbkworks/adapter-element-plus/style.css'
import '@fbkworks/components/style.css'

createApp(App)
  .use(createBusinessKit({ adapter: elementPlusAdapter, theme: 'light' }))
  .mount('#app')
```

UI 库本体样式仍由应用自己引入（`element-plus/dist/index.css` 等），与不使用 FBK 时完全一致。

::: warning 不要指望自动探测
`useAdapter()` 在找不到适配器时会直接抛错并附文档链接，**不会**尝试 `require('element-plus')`。
自动探测会破坏"只装所需适配器"的承诺，且 SSR / 微前端下的行为不可预测。
:::

## 第一个页面

```vue
<script setup lang="ts">
import { FbkProTable } from '@fbkworks/components/pro-table'
import type { ProTableColumn } from '@fbkworks/components/pro-table'

interface Order {
  id: number
  orderNo: string
  amount: number
}

const columns: ProTableColumn<Order>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
]

const request = async ({ page, pageSize, signal }: any) => {
  const response = await fetch(`/api/orders?page=${page}&size=${pageSize}`, { signal })
  const data = await response.json()
  return { list: data.list, total: data.total }
}
</script>

<template>
  <FbkProTable :columns="columns" :request="request" row-key="id" />
</template>
```

同一份代码：

- 在 element-plus 下渲染为可排序、可选中的表格；
- 在 naive-ui 下渲染为表格；
- 在 vant 下渲染为卡片列表，`orderNo` 是标题，其余字段按 `mobile.order` 排列，分页变成下拉加载。

## 切换适配器

改两行：

```diff
- import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
+ import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'
- import '@fbkworks/adapter-element-plus/style.css'
+ import '@fbkworks/adapter-naive-ui/style.css'

-   .use(createBusinessKit({ adapter: elementPlusAdapter }))
+   .use(createBusinessKit({ adapter: naiveUiAdapter }))
```

业务页面零改动。

## 局部切换（微前端 / Playground）

```vue
<script setup lang="ts">
import { FbkProvider } from '@fbkworks/adapter-core'
</script>

<template>
  <FbkProvider :adapter="vantAdapter" theme="dark">
    <OrderList />
  </FbkProvider>
</template>
```

`FbkProvider` 会重新 provide 上下文，子树的 `useAdapter()` 拿到的是新适配器。
切换时建议加 `:key="adapterName"` 强制重建，避免旧适配器的 DOM 状态残留。
