---
"@fbkworks/adapter-vant": minor
---

### vant 的 Select.filterable / clearable 与 DatePicker.clearable 真的生效了

这三个字段以前只声明不读取（渲染体里零引用），传了没有任何效果：

- **filterable**：弹层顶部现在有搜索框，按 label 过滤选项；
- **clearable**：右侧出现自绘的清除按钮（有值且未禁用时），点击清空并 emit change。

清除按钮是自绘的：vant 的 Field 只在**可编辑**时显示自带清除图标，
而这两个组件的展示字段是 readonly（只读展示 + 弹层选择），传 clearable 给它不会出现任何东西。
**体积**：vant 适配器的 JS 从 35.7 → 39.1 KB（+3.3 KB，+9.3%），来自上面两个功能
（关键字过滤、清除按钮、以及两个 computed 的形状判断）。已同步更新 size 基线。
