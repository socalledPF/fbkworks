# FormModal 弹窗表单

把「弹窗 + 表单 + 校验 + 提交」的编排固化下来。这是 CRUD 链路里最后缺的一环：
列表有 CrudPage、表单有 FormGenerator，但「点新建弹出来填、点编辑回填、
提交成功后关闭并刷新列表」此前每个页面都要手写。

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FbkFormModal } from '@fbkworks/components/form-modal'

const show = ref(false)
const mode = ref<'create' | 'edit'>('create')
const current = ref<Record<string, any>>({})

const schema = {
  columns: 1,
  fields: [
    { name: 'orderNo', label: '订单号', type: 'input', required: true },
    { name: 'amount', label: '金额', type: 'number' },
  ],
}

async function submit(values: Record<string, any>) {
  await api.save(values)
  // 不返回值 = 成功；返回 false 或抛错 = 失败
}
</script>

<template>
  <FbkFormModal
    v-model:show="show"
    :mode="mode"
    :schema="schema"
    :initial-values="current"
    :submit="submit"
    @success="reload"
  />
</template>
```

## 提交契约

`submit` 的返回值决定弹窗行为：

| 返回 | 行为 |
|---|---|
| `undefined` / `true` | 成功：触发 `success`，默认自动关闭 |
| `false` | 失败：保持打开，**保留用户输入** |
| `throw` / `reject` | 失败：触发 `error`，保持打开 |

失败时保持打开是刻意的——直接关掉会让用户重填一遍。

## 内建的四条编排

| 行为 | 为什么 |
|---|---|
| 打开时按 `mode` 回填 | `create` 用 `defaultValues`，`edit` 用 `initialValues` |
| 关闭时清空校验 | 否则下次打开会带着上次的红框 |
| 提交中禁止关闭 | 半途关掉会导致状态与后端不一致 |
| 失败保留输入 | 见上 |

## 打开方式

除了 `v-model:show`，也可以用实例方法：

```ts
const modal = ref()

modal.value.open()                 // 新建
modal.value.openEdit(row)          // 编辑并回填
modal.value.close()
await modal.value.submit()         // 手动触发提交
```

## 注意：同一 tick 更新回填值与显隐

业务侧常见写法：

```ts
current.value = row
show.value = true
```

FormModal 内部用 `flush: 'post'` 的 watch 保证读到的是更新后的 `initialValues`。
若改成默认的 `'pre'`，回调会在组件更新前执行，拿到上一轮的值——
表现为「弹窗打开了但输入框全空」。

## API

| 属性 | 说明 |
|---|---|
| `show` | 显隐，支持 `v-model:show` |
| `mode` | `create` / `edit`，影响默认标题与提交按钮文案 |
| `schema` | FormGenerator 的 schema |
| `initialValues` | edit 模式回填值 |
| `defaultValues` | create 模式初始值 |
| `submit` | 提交处理，见上表 |
| `title` | 覆盖默认标题 |
| `width` | 弹窗宽度 |
| `placement` | `center` / `bottom`（移动端底部弹出） |
| `closeOnSuccess` | 成功后是否自动关闭，默认 `true` |
| `submitText` / `cancelText` | 按钮文案 |

| 事件 | 说明 |
|---|---|
| `success` | 提交成功，参数 `(values, mode)` |
| `error` | 提交失败，参数 `(error)` |
| `open` / `close` | 打开 / 关闭 |

| 插槽 | 说明 |
|---|---|
| `footer` | 覆盖底部按钮区，参数 `{ submitting, submit, close }` |
| `field-<name>` | 转发给 FormGenerator 的字段插槽 |
