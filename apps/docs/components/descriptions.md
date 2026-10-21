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

## 分组

详情页常见「基本信息 / 联系方式 / 扩展属性」三段式。用 `groups` 声明分组，
条目通过 `groups: ['key']` 归属：

```vue
<FbkDescriptions
  :data="employee"
  :items="items"
  :groups="[
    { key: 'basic', title: '基本信息' },
    { key: 'contact', title: '联系方式' },
    { key: 'extended', title: '扩展信息', collapsible: true, defaultCollapsed: false },
  ]"
/>
```

归组规则（按优先级）：

1. `item.groups` 明确包含某个分组 key → 进该分组（可以同时属于多个）
2. `item.groups` 是空数组、或全是**未知 key** → 落到最后的无标题区
3. `item.groups` 未传 → 进第一个分组

第 2 条刻意不丢弃数据：写错 key 时条目仍然可见，避免「少了一个字段但没人发现」。

### 分组折叠

`collapsible: true` 让分组可折叠，`defaultCollapsed` 控制初始状态。
折叠按钮带 `aria-expanded`，键盘可达。

### 分组级列数

`group.column` 覆盖组件级 `column`：

```ts
{ key: 'basic', title: '基本信息', column: 3 }
```

注意：列数变量（`--fbk-cols-*`）落在每个分组的 `<dl>` 上而不是根元素，
因为各组可以有不同列数。

## 列数与响应式

```vue
<FbkDescriptions :data="order" :items="items" :column="{ xs: 1, sm: 1, md: 2, lg: 3 }" />
```

列数由 CSS Grid 的 `grid-template-columns` + 媒体查询实现，组件本身不做屏幕宽度判断。

## 跨列

```ts
{ key: 'remark', label: '备注', span: 2 }
```

## 空值占位

```ts
{ key: 'phone', label: '电话', emptyText: '未填写' }
```

不传时用 `-`。

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
