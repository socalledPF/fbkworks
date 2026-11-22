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
  label: string
  type: QueryFieldType
  placeholder?: string
  options?: SelectOption[] | SelectOptionsResolver
  defaultValue?: unknown
  hidden?: boolean | ((values: Record<string, any>) => boolean)
  /** type='custom' 时的渲染函数 */
  render?: (ctx: { value: unknown; values: Record<string, any>; setValue: (v: unknown) => void }) => VNodeChild
}
```

`custom` 是逃生舱：需要业务特有控件时不必扩展契约。

### 选项联动

`options` 除静态数组外还可以是一个函数：`SelectOptionsResolver` 收到当前表单值，返回选项数组。

```ts
type SelectOptionsResolver = (values: Record<string, any>) => SelectOption[]
```

```ts
{
  name: 'city',
  label: '城市',
  type: 'select',
  // 收到当前表单值，返回选项
  options: (values) => CITIES_OF[values.province] ?? [],
}
```

**表单值一变就重新求值**：选完省份，城市的候选值立刻换掉。业务方不必自己 `watch` 省份再手改
`options`，也就不会出现「省份变了，城市还挂着旧选项」。解析函数抛错时退化成空选项，
只影响这一个字段，查询区不会整片白屏。

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

点「查询」**不做校验**：`submit` 只把当前值 `emit` 出去。按钮原语的 `nativeType` 默认是 `button`，
也不会触发浏览器原生 submit —— 点了就是点了。

需要校验请自己调 `validate()`（返回 `Promise<true>`，不通过就 reject）：

```ts
const formRef = ref()
async function onSearch(values: Record<string, any>) {
  await formRef.value.validate() // 不通过会 reject
  search(values)
}
```

`reset` 会恢复 `defaultValues` 并触发一次 `change`。

## 字段插槽

```vue
<FbkQueryForm :fields="fields">
  <!-- 插槽参数是 value / setValue / values —— **没有 onChange**（写错的话选完值不回写，且不报错） -->
  <template #field-owner="{ value, setValue }">
    <UserPicker :model-value="value" @update:model-value="setValue" />
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
