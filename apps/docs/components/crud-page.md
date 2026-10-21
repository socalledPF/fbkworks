# CrudPage CRUD 页面

把「查询表单 + 表格 + 分页 + 请求」的联动固化下来。企业后台最常见的页面骨架，
此前每个页面都要手写这段连接，且容易漏掉「重置要连表格一起重置」这类细节。

## 基础用法

```vue
<script setup lang="ts">
import { FbkCrudPage } from '@fbk/components/crud-page'

const fields = [
  { name: 'keyword', label: '关键词', type: 'input' },
  { name: 'createdAt', label: '创建日期', type: 'date' },
]

const columns = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money' },
]

const request = async ({ page, pageSize, params, signal }) => {
  const res = await fetch(`/api/orders?page=${page}&size=${pageSize}&kw=${params.keyword}`, { signal })
  return res.json()
}
</script>

<template>
  <FbkCrudPage :query-fields="fields" :columns="columns" :request="request" row-key="id" />
</template>
```

## 内建的三条联动

| 行为 | 说明 |
|---|---|
| 只在 `submit` / `reset` 联动 | 输入过程中不发请求，避免每敲一个字打一次接口 |
| 重置连表格一起重置 | 否则表单空了但表格还筛着旧条件 |
| `params` 变化回到第一页 | 由 `useTableRequest` 保证，不需要手动设页码 |

## 刻意不做的事

CrudPage 只负责**列表这一屏**，避免变成"万能组件"：

- **不内置弹窗表单** —— 用 `form` 插槽，业务方自己控制显隐与提交
- **不内置请求库** —— `request` 仍是调用方注入的函数（保持零依赖）
- **不内置增删改** —— 只负责列表

## 插槽

| 名称 | 参数 | 说明 |
|---|---|---|
| `toolbar` | `{ params, selectedKeys }` | 表格上方工具栏，如「新建」按钮 |
| `bulk-actions` | `{ selectedKeys, clear }` | 批量操作区 |
| `form` | — | 弹窗表单等，渲染在表格之后 |
| `cell-<key>` | 同 ProTable | 覆盖某一列的单元格 |

## 暴露方法

| 方法 | 说明 |
|---|---|
| `refresh()` | 保留当前条件重新查询 |
| `reset()` | 清空条件并重新查询 |
| `getParams()` | 当前生效条件（返回副本） |
| `getData()` | 当前行数据 |
| `getSelectedKeys()` | 当前选中项 |
| `clearSelection()` | 清空选择 |

## 与手工连接的对比

见 [pro-table/with-query](/#) demo：手工写需要 watch 表单提交、维护 params、
处理重置联动；用 CrudPage 只需要传 `queryFields` 与 `columns`。
