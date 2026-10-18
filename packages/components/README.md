# @fbk/components

Vue 3 企业级业务组件。同一份业务代码可在 element-plus、vant4、naive-ui 下运行——
UI 库通过适配器注入，组件公开 API 里不出现任何 UI 库类型。

```bash
pnpm add @fbk/components @fbk/adapter-core
pnpm add @fbk/adapter-element-plus   # 或 @fbk/adapter-vant / @fbk/adapter-naive-ui
```

## 组件

| 组件 | 子路径 | 说明 |
|---|---|---|
| `FbkProTable` | `@fbk/components/pro-table` | 请求 / 分页 / 排序 / 多选 / 列渲染，移动端自动变卡片 |
| `FbkQueryForm` | `@fbk/components/query-form` | schema 驱动的查询区，支持折叠与字段插槽 |
| `FbkFormGenerator` | `@fbk/components/form-generator` | schema 驱动的表单，含规则归一化与只读模式 |
| `FbkPageContainer` | `@fbk/components/page-container` | 页面骨架：标题、面包屑、返回、固定头部 |
| `FbkDescriptions` | `@fbk/components/descriptions` | 详情键值展示，**不需要适配器** |

## 使用

```ts
import { createBusinessKit } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import '@fbk/tokens/css'
import '@fbk/adapter-element-plus/style.css'
import '@fbk/components/style.css'

createApp(App).use(createBusinessKit({ adapter: elementPlusAdapter }))
```

按需样式：

```ts
import '@fbk/components/pro-table/style.css'
```

```vue
<script setup lang="ts">
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn } from '@fbk/components/pro-table'

const columns: ProTableColumn<Order>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
]
</script>

<template>
  <FbkProTable :columns="columns" :request="request" row-key="id" />
</template>
```

## 设计约束

- 零业务运行时依赖：请求由 `request` 注入，日期格式化用 `Intl`
- `uiProps` 是 `Record<string, any>`，公开 API 不泄漏 UI 库类型
- 样式是独立 CSS 文件（不使用 SFC `<style>`），`sideEffects` 只标记 CSS
- ESM-only

## License

MIT
