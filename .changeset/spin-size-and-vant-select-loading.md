---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-vant": patch
---

### 删掉 `SpinProps.size`；vant 的 Select 在 loading 期间不可交互

**`SpinProps.size`** 三个适配器的 Spin 都没有这个 prop，传了只会经 `{...attrs}`
漏成 `<div size="lg">` 这种非法属性（与 `loadMore`/`finished` 同一类问题）。

**vant `Select` 的 `loading`** 以前只声明不读取 —— element-plus / naive-ui 都是
`disabled={disabled || loading}`，只有 vant 允许在加载中拉开一个空列表再选。现在一致。