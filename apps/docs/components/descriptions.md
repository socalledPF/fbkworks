# Descriptions 描述列表

详情页的键值展示。**它完全不依赖适配器**——只用 tokens 与 CSS Grid。

这验证了一个重要原则：不是所有组件都要经过适配层。
纯展示/布局组件直接吃令牌更稳、更轻，也不会被 UI 库的版本升级牵连。

## 基础用法

<DemoBlock id="page-container/basic" />

（上面的 demo 同时展示了 `PageContainer` 与 `Descriptions`。）

```vue
<FbkDescriptions
  :data="order"
  bordered
  :items="[
    { key: 'orderNo', label: '订单号' },
    { key: 'customer', label: '客户' },
    { key: 'amount', label: '金额', getValue: (row) => `¥${row.amount}` },
  ]"
/>
```

## 列数与响应式

```vue
<FbkDescriptions :data="order" :items="items" :column="{ xs: 1, sm: 1, md: 2, lg: 3 }" />
```

列数由 CSS Grid 的 `grid-template-columns` + 媒体查询实现，组件本身不做屏幕宽度判断。

## 跨列

```ts
{ key: 'remark', label: '备注', span: 2 }
```

## 自定义渲染

```vue
<FbkDescriptions :data="order" :items="items">
  <template #item-status="{ row }">
    <StatusTag :status="row.status" />
  </template>
</FbkDescriptions>
```

插槽名为 `item-<itemKey>`；也可以直接在 item 上写 `render`。

## API

<ApiTable component="Descriptions" />

<ApiTable component="Descriptions" section="slots" />
