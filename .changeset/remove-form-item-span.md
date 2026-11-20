---
"@fbkworks/components": minor
"@fbkworks/adapter-core": minor
---

### 删掉 `FormItemProps.span` / `QueryField.span`

这个字段从来没被实现过：三个适配器的 `FormItem` 都只声明不读取（`props.span` 引用数为 0），
`QueryForm` / `FormGenerator` 一路把它透传下去，最后什么也没发生 ——
而文档写着「跨列」。写 `span: 2` 的人会以为布局没生效是别的原因。

**迁移**：删掉即可，行为不变（它本来就不生效）。

「多列表单」如果要做，正确形态是 `QueryForm` 层面的 `columns` 布局开关，
而不是逐字段写 `span` —— 那样才能在移动端做响应式单列。

（`DescriptionsItem.span` 是详情页的另一个字段，**不受影响**。）