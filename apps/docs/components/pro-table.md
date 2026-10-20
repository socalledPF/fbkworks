# ProTable 高级表格

价值最大、适配最难的组件。它把"请求、分页、排序、选择、列渲染"收敛成一套 schema，
底层由适配器决定渲染成表格还是卡片列表。

## 基础用法

<DemoBlock id="pro-table/basic" />

同一份代码在三种适配器下的表现：

- **element-plus / naive-ui**：表格，表头可排序，底部分页。
- **vant**：卡片列表。`mobile.primary` 的列成为标题，其余列按 `mobile.order` 排成键值对；
  `mobile.hidden` 的列不显示；分页变为下拉加载更多。

## 多选与批量操作

<DemoBlock id="pro-table/selection" />

`selection` 能力由 `adapter.capabilities.dataGrid.selection` 声明。
适配器不支持时（`selection: false`），ProTable 不会渲染选择列，也不会报错。

`selection` 也可以传配置对象：

```ts
selection: {
  /** 选择列宽度，默认 48 */
  columnWidth: 56,
  /** reload 后是否保留已选行，默认 true */
  preserveOnReload: false,
}
```

### 表头全选

渲染了选择列且当前页有数据时，表格上方会出现「全选当前页」。

它**只作用于当前页**——跨页全选需要后端返回全量 key，库不做虚假承诺。
「部分选中」用 `indeterminate` 呈现，不是「未选中」。

批量操作按钮放进 `bulk-actions` 插槽，插槽参数是当前选中项：

```vue
<FbkProTable v-model:selected-keys="selected" :columns="columns" :request="request">
  <template #bulk-actions="{ selectedKeys, clear }">
    <button :disabled="!selectedKeys.length" @click="batchDelete(selectedKeys)">批量删除</button>
    <button :disabled="!selectedKeys.length" @click="clear">清空</button>
  </template>
</FbkProTable>
```

## 操作栏

`valueType: 'actions'` 的列渲染成一组操作按钮。此前它只是类型里的一个标记、
没有任何实现——写了它而不写 `render`，单元格会是空白。

```ts
{
  key: 'op',
  title: '操作',
  valueType: 'actions',
  width: 160,
  max: 2,                    // 直接显示几个，其余折叠进「更多」，默认 3
  actions: [
    { key: 'view', text: '查看', onClick: ({ row }) => open(row) },
    { key: 'edit', text: '编辑', disabled: ({ row }) => row.status === 2, onClick: ({ row }) => edit(row) },
    { key: 'copy', text: '复制单号', visible: ({ row }) => Boolean(row.orderNo), onClick: ... },
    { key: 'delete', text: '删除', status: 'danger', confirm: '确定删除？', onClick: ... },
  ],
}
```

| 字段 | 说明 |
|---|---|
| `key` | 稳定标识，落在 `data-action-key` 上便于测试 |
| `text` | 按钮文案 |
| `status` | `success` / `warning` / `danger` / `info`，决定颜色语义 |
| `variant` | `default` / `primary` / `text` / `link` |
| `confirm` | 非空则点击前弹 `window.confirm` 二次确认 |
| `visible` | 布尔或 `(ctx) => boolean`，按行求值 |
| `disabled` | 布尔或 `(ctx) => boolean`，按行求值 |
| `onClick` | `(ctx) => void`，`ctx` 是 `{ row, index }` |

约定：

- 点击 action **不会**触发行点击（内部 `stopPropagation`）。
- 超过 `max` 个折叠进「更多」，用原生 `<details>`，不引入弹层依赖，键盘可达。
- 与 `render` 同时存在时，`render` 优先，保留逃生舱。

## 列配置

```ts
interface ProTableColumn<T> extends DataGridColumn<T> {
  valueType?: 'text' | 'number' | 'money' | 'date' | 'datetime' | 'tag' | 'enum' | 'image' | 'actions'
  valueEnum?: Record<string | number, { text: string; status?: Status }>
  hideInTable?: boolean
  hideInCard?: boolean
  search?: boolean | QueryField
  /** 悬停以原生 tooltip 展示的说明 */
  tooltip?: string
  /** 悬停显示复制按钮，点击写入剪贴板 */
  copyable?: boolean
}
```

`valueType` 是"业务语义"，由业务组件解析成 `render` 函数；**适配器不需要知道什么是金额**。

```ts
{ key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' }
{ key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum }
```

`copyable` 与 `tooltip` 包在单元格内容外面，与 `valueType` / 自定义 `render` 都能组合：

```ts
{ key: 'orderNo', title: '订单号', valueType: 'text', copyable: true, tooltip: '业务单号' }
```

复制按钮默认只在行悬停或键盘聚焦时出现（触屏设备常驻）。`copyable` 需要列本身有渲染结果，
纯文本列请配合 `valueType` 或 `render` 使用。

## 请求与竞态

`request` 收到的参数里带 `signal`：

```ts
const request = async ({ page, pageSize, sort, params, signal }: TableRequestParams) => {
  const res = await fetch(`/api/orders?page=${page}`, { signal })
  return { list: (await res.json()).list, total: 100 }
}
```

内部用 `AbortController` + 单调递增的 `requestId` 双保险：快速翻页时旧响应会被丢弃，
组件卸载时会 abort 在途请求。

## 受控与非受控

"存在即受控"：prop 为 `undefined` 时组件自己管理状态，传入值即受控。

```vue
<!-- 非受控：内部管理页码 -->
<FbkProTable :columns="columns" :request="request" />

<!-- 受控：页码由外部驱动 -->
<FbkProTable
  :columns="columns"
  :request="request"
  :page="page"
  @update:page="page = $event"
/>
```

`data` 与 `request` 二选一。传入 `data` 时不发请求、不渲染分页。

## 能力降级

```ts
const adapter = createMockAdapter({ dataGrid: { selection: false } })
```

此时不渲染选择列。业务代码不需要写 `if (adapter.name === 'vant')`。

## 插槽

| 名称 | 说明 |
|---|---|
| `toolbar` | 表格上方工具栏 |
| `bulk-actions` | 批量操作按钮区，参数 `{ selectedKeys, clear }`；无选中时也渲染 |
| `cell-<columnKey>` | 覆盖某一列的单元格渲染 |
| `card-footer` | 移动端卡片底部 |

```vue
<FbkProTable :columns="columns" :request="request">
  <template #toolbar>
    <button @click="reload">刷新</button>
  </template>
  <template #cell-actions="{ row }">
    <a @click="edit(row)">编辑</a>
  </template>
</FbkProTable>
```

## 暴露方法

| 方法 | 说明 |
|---|---|
| `reload(options?)` | 重新请求，`{ resetPage: true }` 回到第一页 |
| `getData()` | 当前行数据 |
| `clearSelection()` | 清空选择 |
| `setSelectedKeys(keys)` | 设置选中行 |

## API

<ApiTable component="ProTable" />

<ApiTable component="ProTable" section="events" />

<ApiTable component="ProTable" section="slots" />

<ApiTable component="ProTable" section="exposed" />
