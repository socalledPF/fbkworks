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

## 列配置

```ts
interface ProTableColumn<T> extends DataGridColumn<T> {
  valueType?: 'text' | 'number' | 'money' | 'date' | 'datetime' | 'tag' | 'enum' | 'image' | 'actions'
  valueEnum?: Record<string | number, { text: string; status?: Status }>
  hideInTable?: boolean
  hideInCard?: boolean
  copyable?: boolean
  search?: boolean | QueryField
}
```

`valueType` 是"业务语义"，由业务组件解析成 `render` 函数；**适配器不需要知道什么是金额**。

```ts
{ key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' }
{ key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum }
```

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
