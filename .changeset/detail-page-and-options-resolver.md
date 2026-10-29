---
"@fbkworks/components": minor
---

feat(components): 新增 `DetailPage`，`options` 支持函数形式

### `DetailPage`：详情页的约定

`CrudPage` 把列表页的加载/空/错误变成了组件约定，但详情页没有对应物 ——
每写一个详情页重复 5-8 行三态代码，且表现不一致（有人用 `FbkResult`，
有人用一行「加载中…」），错误也不会走 `useReporter()`。

`FbkDetailPage` 组合 `PageContainer` + `Descriptions` + `Result`，只做编排：

```vue
<FbkDetailPage
  :request="() => fetchOrder(id)"
  :items="items"
  :title="(d) => `订单 ${d.orderNo}`"
  back
>
  <template #extra="{ data }"><OrderTimeline :order="data" /></template>
</FbkDetailPage>
```

三态约定：
- 加载中 → 骨架（不是文字，文字会闪）
- 请求失败 → `Result status="error"` + 重试
- **返回 null → `Result status="404"`** —— 不是错误，是资源不存在

把 404 显示成「加载失败」会让用户反复重试一个不存在的资源。

同时导出 `useDetail` / `useDetailWatch` composable，供需要自定义模板的场景。
两者共用同一份实现，不会漂移。

### `options` 支持函数形式

```ts
{ name: 'city', label: '城市', type: 'select',
  options: (values) => CITIES_OF[values.province] ?? [] }
```

省了业务方自己 watch 省份再改 options 的绕法，也不会出现
「省份变了但城市还留着旧选项」的状态不同步。

解析函数抛错时退化为空选项，不让整个表单崩。

### 修复

`CrudPage` 的 `useSlots()` 在 dts 构建阶段报 TS7022（隐式 any）——
这个错误只在 `build` 时出现，`typecheck` 看不到。已显式标注类型。
