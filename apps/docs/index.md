---
layout: home

hero:
  name: FBK
  text: 一套业务组件，三种 UI 适配器
  tagline: element-plus / vant4 / naive-ui 共用同一份业务页面代码
  actions:
    - theme: brand
      text: 为什么需要适配层
      link: /guide/introduction
    - theme: alt
      text: 快速开始
      link: /guide/getting-started

features:
  - title: 业务代码与 UI 库解耦
    details: 业务组件只依赖 adapter-core 契约，公开 d.ts 里不出现任何 UI 库类型。换库只改入口注入代码。
  - title: 三种适配器，一套契约
    details: element-plus 与 naive-ui 渲染表格，vant 渲染卡片列表；同一套列描述、同一套事件。
  - title: 能力声明优先于功能对齐
    details: 不追求三库像素一致。适配器声明 capabilities，业务组件按能力降级。
  - title: 逃生舱而非穷举映射
    details: 映射不到的原生 props 走 uiProps 透传，契约不会被三库的 props 淹没。
---
