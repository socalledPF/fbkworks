# 设计稿：`DetailPage` —— 详情页的约定

> P4-1。把「列表页已有的三态约定」延伸到详情页。

## 一、问题

实测 `apps/admin` 四个页面的三态处理分布：

| 页面 | 行数 | 三态处理（loading/error/data） |
|---|---|---|
| OrdersPage（用 `CrudPage`） | 246 | **0**（组件包了） |
| UsersPage（用 `CrudPage`） | 103 | **0**（组件包了） |
| OrderDetailPage（手写） | 198 | **5**（自己写） |
| WorkbenchPage（手写） | 227 | **8**（自己写） |

`CrudPage` 把「列表页的加载/空/错误」变成了组件约定，但**详情页没有任何对应物**。

后果：
1. 每写一个详情页重复一遍 `loading = ref(true)` + `try/finally` + 三态分支
2. 三态表现不一致（有人用 `FbkResult`，有人用一行「加载中…」）
3. 详情页的错误不会走 `useReporter()`，监控里是个黑洞

## 二、方案：组合而非新造

`DetailPage` **不实现任何渲染逻辑**，只做编排：

```
FbkDetailPage
  ├── PageContainer   标题 / 面包屑 / 返回按钮
  ├── 三态分支
  │     ├── loading → 骨架
  │     ├── error   → Result status="error"
  │     ├── null    → Result status="404"
  │     └── data    → Descriptions + 插槽
  └── Descriptions    字段渲染（items 直接透传）
```

**关键决策：`items` 直接复用 `DescriptionItem`**，不另设计一套。
两套字段描述会让用户困惑——`Descriptions` 里能写的，详情页里应该也能写。

## 三、API

```vue
<FbkDetailPage
  :request="() => fetchOrder(id)"
  :items="items"
  :column="2"
  title="订单详情"
  :breadcrumbs="[{ text: '订单列表', to: '/orders' }, { text: '详情' }]"
  back
  @back="navigate('/orders')"
>
  <!-- 额外区块：接在 Descriptions 之后 -->
  <template #extra="{ data }">
    <OrderTimeline :order="data" />
  </template>

  <!-- 操作区：接在页面底部 -->
  <template #actions="{ data }">
    <button @click="edit(data)">编辑</button>
  </template>

  <!-- 每个字段可以单独覆盖渲染 -->
  <template #field-status="{ value }">
    <FbkTag>{{ value }}</FbkTag>
  </template>
</FbkDetailPage>
```

### Props

| prop | 类型 | 说明 |
|---|---|---|
| `request` | `() => Promise<T \| null>` | 取详情。`null` 视为 404 |
| `items` | `DescriptionItem<T>[]` | 字段描述，直接透传给 Descriptions |
| `title` | `string \| ((data: T) => string)` | 标题。传函数时可用数据里的字段 |
| `subtitle` | `string` | |
| `breadcrumbs` | `BreadcrumbItem[]` | |
| `back` | `boolean \| (() => void)` | 返回按钮 |
| `column` | `number \| { xs/sm/md/lg }` | 列数，透传 Descriptions |
| `groups` | `string[]` | 分组，透传 Descriptions |
| `emptyText` | `string` | 字段为空时的占位 |
| `immediate` | `boolean` | 默认 `true`，挂载即请求 |

### Slots

| slot | 参数 | 用途 |
|---|---|---|
| `extra` | `{ data: T }` | 额外区块（时间线、关联列表） |
| `actions` | `{ data: T }` | 操作区 |
| `field-${key}` | `{ data, value }` | 覆盖单个字段的渲染 |

### Expose

```ts
{ data, loading, error, reload }
```

## 四、关键约定

| 约定 | 值 | 理由 |
|---|---|---|
| 数据获取 | `request: () => Promise<T \| null>` | 不带分页参数——详情就是一次取一条 |
| `null` 语义 | 404 | 接口返回空 = 资源不存在，这是最自然的映射 |
| 加载态 | 骨架（不是「加载中…」文字） | 与 ProTable 的表现一致；文字会闪 |
| 错误态 | `Result status="error"` + 重试按钮 | 错误要能自我恢复 |
| 错误上报 | 自动走 `useReporter()` | 与 `ProTable` 同一出口，不要求业务方手接 |
| 竞态 | 内置 `AbortController` | 快速切换 id 时旧请求要取消 |

## 五、`useDetail` composable

组件同时导出一个 composable，给需要完全自定义模板的场景：

```ts
const { data, loading, error, reload } = useDetail(() => fetchOrder(id))
```

**为什么两个都给**：
- 组件解决「三态表现不一致」（这是主要价值）
- composable 保留逃生口（复杂详情页需要自己的布局）

两者共用同一份实现，不会漂移。

## 六、验收

| 项 | 标准 |
|---|---|
| 复用 | 不新造渲染逻辑，全部组合现有组件 |
| 三态一致 | loading/error/404 的表现与 `CrudPage` 相同 |
| 错误上报 | 失败时自动走 `useReporter()`，`source: 'component'` |
| 竞态 | 快速切换 id 时旧响应被丢弃 |
| 兼容 | 现有 8 个组件 API 零改动 |
| 单测 | 三态 / 404 / 错误上报 / 插槽透传 / `title` 函数形式 |
| 门禁 | `pnpm verify` 全绿，样式注册到两处入口 |
| 实测 | admin 详情页改造后 E2E 22 项仍全过 |

## 七、不做

| 不做 | 理由 |
|---|---|
| 内置编辑态 | 编辑用 `FormModal`，详情页只读 |
| 内置 Tab 分组 | `groups` 已覆盖多数场景；复杂分页交给 `extra` 插槽 |
| 自动推断 `items` | 从 TS 类型推断字段标签需要运行时类型信息，成本远超收益 |
| 内置权限控制 | 操作区交给 `actions` 插槽，业务方用 `v-permission` |
