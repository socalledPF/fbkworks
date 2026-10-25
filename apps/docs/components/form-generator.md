# FormGenerator 表单生成器

新增/编辑弹窗的表单通常是"字段 + 规则 + 两列布局"的重复劳动。
FormGenerator 用 schema 描述表单，并在三种适配器下保持一致的校验语义。

## 基础用法

<DemoBlock id="form-generator/basic" />

## Schema

```ts
interface FormSchema<T> {
  fields: FormField[]
  groups?: Array<{ title?: string; fields: string[] }>
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  labelWidth?: string | number
  labelPosition?: 'left' | 'right' | 'top'
  rules?: Record<string, FbkRule[]>
}
```

字段按 `groups` 分组时，每组渲染一个小标题；未出现在任何 group 里的字段会被忽略（避免"写漏了但看不出来"时静默渲染）。

## 校验规则

契约只承诺一个最小子集，各适配器自行翻译：

```ts
interface FbkRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'email' | 'url'
  min?: number
  max?: number
  len?: number
  pattern?: RegExp
  message?: string
  trigger?: 'blur' | 'change'
  validator?: (value: unknown) => boolean | Promise<boolean>
}
```

`field.required: true` 会自动补一条必填规则，不需要同时写 `rules`。

::: tip vant 的 validate()
vant 的 Form 没有命令式 `validate()`。适配器用 `@submit` / `@failed` 事件桥接成 `Promise<true>`，
所以业务代码在三个适配器下写法完全一致：

```ts
await formRef.value.validate()
```
:::

## 只读模式

```vue
<FbkFormGenerator :schema="schema" :model-value="detail" mode="view" />
```

`mode="view"` 渲染纯文本而不是禁用输入框——禁用态在视觉上仍然像表单，只读详情页应该像详情页。

## 与弹窗配合

```vue
<script setup lang="ts">
const formRef = ref()

async function onConfirm() {
  await formRef.value.validate()
  await save(formRef.value.getValues())
}
</script>

<template>
  <FbkFormGenerator ref="formRef" :schema="schema" v-model="model" :show-actions="false" />
</template>
```

## API

<ApiTable component="FormGenerator" />

<ApiTable component="FormGenerator" section="events" />

<ApiTable component="FormGenerator" section="slots" />

<ApiTable component="FormGenerator" section="exposed" />

## 字段联动

`options` 支持两种形态：静态数组与函数。

### 静态（多数场景）

```ts
{ name: 'status', label: '状态', type: 'select',
  options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
```

### 动态：选项随其他字段变化

```ts
{
  name: 'city',
  label: '城市',
  type: 'select',
  // 收到当前表单值，返回选项
  options: (values) => CITIES_OF[values.province] ?? [],
}
```

省了业务方自己 `watch` 省份再改 `options` 的绕法，也不会出现
「省份变了但城市还留着旧选项」这种状态不同步。

### 抛错时退化为空选项

解析函数抛错不会让表单崩 —— 那个字段的选项变空，其他字段正常。
一个字段的选项算错不该白屏。

### 与 `disabled` 的区别

| 能力 | 用途 |
|---|---|
| `disabled: (values) => boolean` | 整个字段能不能填 |
| `options: (values) => Option[]` | 能填什么 |

两者可以组合：`disabled` 控制是否可交互，`options` 控制候选值。
