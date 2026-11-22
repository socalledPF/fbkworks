---
"@fbkworks/components": minor
"@fbkworks/screen": minor
---

### 类型与契约族：把「声明了不生效」的四处补齐或删掉

这一批改动只有一个主题：**类型里承诺的东西必须是运行时真的做了的事**。
四处违约各有各的方向 —— 该有的类型没有（传了没报错、也生效不了），
不该有的字段还在（写了没效果），注释写着另一种行为（读的人会被误导）。

#### CrudPage 插槽：`field-*` 等六个名字补进类型（不破版，是修漏）

`CrudPage.vue` 的 `passedSlots` / `passedQuerySlots` 已经转发 `empty` / `card-footer` /
`actions` / `before-actions` / `after-actions` / `field-<name>`，但 `CrudPageSlots` 里只有
`toolbar` / `bulk-actions` / `error` / `form` / `cell-*`。

后果是「运行时能跑、模板里报错」：`<template #field-status>` 在 `FbkCrudPage` 上直接
TS 报错（`v-for` 动态转发不参与模板类型检查，所以没人发现），IDE 也不补全。
现在补上两个模板字面量索引签名（`cell-*` 与 `field-*` 可以并存）。

`apps/docs/components/crud-page.md` 的插槽表同步补齐，并写明它必须与两个白名单逐字对齐。

#### `CrudPageProps.tableProps` 不再接受 `immediate`（**破版：类型**）

`tableProps` 的 `Omit` 没排除 `immediate`，但 `CrudPage.vue` 展开时是
`{ ...tableProps, ..., immediate: props.immediate }` —— 写在 tableProps 里的那个
在对象里排前面，**被顶层 prop 静默压掉**：类型合法、行为无效。

**迁移**：把 `:table-props="{ immediate: false }"` 改成 `:immediate="false"`。
行为不变（那种写法本来就不生效），只是现在会在编译期报错而不是静默忽略。
其余 `tableProps` 字段（`page` / `pageSize` / `pagination` / `uiProps` 等）不受影响。

#### `ProTableSlots['bulk-actions']` 的注释按实现改正（不破版）

注释写着「仅在选中行时渲染」，而 `ProTable.vue:276` 的条件是
`selectionEnabled && rowKeys.length > 0 && !errorState` —— **没有选中行时也渲染**，
表头「全选当前页」与已选计数就在这个容器里。照旧注释写的人会给按钮漏掉
`selectedKeys.length` 判断，于是「0 选中也能点批量删除」。只改注释，行为未动。

#### `FormModal`：关闭时清掉命令式残留值（修 bug，不破版）

`pendingValues` 只在 `show` 发生 false→true 跳变时被消费。于是只要出现一次
「命令式打开但 show 没有跳变」—— 已打开状态下再 `openEdit()` 一次，或父级否决了
这次打开 —— 它就留到下一轮，**盖掉 initialValues**：表现为「编辑 A，表单里是上一次的 B，
保存把 B 写进 A」。现在 `clearOnClose` 里一并置 `null`，并用一条用例钉住
（`packages/components/tests/form-modal.spec.ts`，先红后绿）。

顺带删掉 `withDefaults` 里残留的 `autoFocus: true` —— 该 prop 在 0.8.0 已从类型删除，
SFC 编译器会静默丢弃未声明的默认值，但留着等于承诺一个不存在的 prop。

#### `ScreenPageProps.fullscreen` 删除（**破版：类型**）

`ScreenPage` 只渲染一个默认插槽，从不渲染 `ScreenHeader` —— `fullscreen` 在模板里
零引用，传了没有任何效果。真正读它的是 `ScreenHeader.vue:78`。

**迁移**：把 `fullscreen` 写到 Header 上，而不是页面容器上：

```vue
<!-- 之前：声明了、但不生效 -->
<FbkScreenPage :fullscreen="false"> ... </FbkScreenPage>

<!-- 现在 -->
<FbkScreenPage>
  <FbkScreenHeader title="运营监控" :fullscreen="false" />
  ...
</FbkScreenPage>
```

两个包都按本仓 0.x 的既有约定用 **minor**（0.8.0 删掉 `ProTableAction.icon`、
`FormModal.autoFocus` 等死字段时同样是 minor）：删掉的是**从来没生效过**的声明，
迁移只需改一行，运行时行为不变。
