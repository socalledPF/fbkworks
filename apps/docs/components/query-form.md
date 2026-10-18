# QueryForm 查询表单

列表页的查询区几乎每个页面都要写一遍：字段排布、折叠、重置、提交、loading。
QueryForm 把它收敛成 `fields` 数组。

## 基础用法

<DemoBlock id="query-form/basic" />

## 字段配置

```ts
type QueryFieldType =
  | 'input' | 'textarea' | 'number'
  | 'select' | 'radio' | 'checkbox' | 'switch'
  | 'date' | 'date-range' | 'custom'

interface QueryField {
  name: string
  label?: string
  type?: QueryFieldType
  placeholder?: string
  options?: SelectOption[]
  defaultValue?: unknown
  span?: number
  hidden?: boolean
  /** type='custom' 时的渲染函数 */
  render?: (ctx: { value: unknown; onChange: (v: unknown) => void; field: QueryField }) => VNodeChild
}
```

`custom` 是逃生舱：需要业务特有控件时不必扩展契约。

## 折叠

```vue
<FbkQueryForm :fields="fields" :visible-count="3" collapsible :columns="3" />
```

超过 `visibleCount` 的字段默认折叠。折叠按钮的显隐由实际字段数决定，字段少时不会出现一个没用的"展开"。

## 响应式列数

```vue
<FbkQueryForm :fields="fields" :columns="{ xs: 1, sm: 2, md: 3, lg: 4 }" />
```

列数走 CSS Grid，不在组件里判断屏幕宽度。

## 受控与非受控

```vue
<!-- 非受控：内部管理 -->
<FbkQueryForm :fields="fields" @submit="search" />

<!-- 受控 -->
<FbkQueryForm v-model="values" :fields="fields" @submit="search" />
```

`submit` 会先校验再抛事件；`reset` 会恢复 `defaultValues` 并触发一次 `change`。

## 字段插槽

```vue
<FbkQueryForm :fields="fields">
  <template #field-owner="{ value, onChange }">
    <UserPicker :model-value="value" @update:model-value="onChange" />
  </template>
</FbkQueryForm>
```

## 与 ProTable 配合

```vue
<script setup lang="ts">
const query = ref<Record<string, any>>({})
const table = ref()

function onSearch(values: Record<string, any>) {
  query.value = values
  table.value?.reload({ resetPage: true })
}
</script>

<template>
  <FbkQueryForm :fields="fields" @submit="onSearch" />
  <FbkProTable ref="table" :columns="columns" :request="request" :params="query" />
</template>
```

`params` 变化会自动重新请求并回到第一页——这是 ProTable 的约定，不需要手写 watch。

## API

<ApiTable component="QueryForm" />

<ApiTable component="QueryForm" section="events" />

<ApiTable component="QueryForm" section="slots" />

<ApiTable component="QueryForm" section="exposed" />
