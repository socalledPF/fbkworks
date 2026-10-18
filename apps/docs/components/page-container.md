# PageContainer 页面容器

统一页面骨架：标题、面包屑、返回、右侧操作区、底部固定操作栏。

## 基础用法

<DemoBlock id="page-container/basic" />

## 为什么面包屑不 import vue-router

```ts
interface BreadcrumbItem {
  text: string
  to?: string
}
```

组件库必须零业务运行时依赖。默认实现把 `to` 渲染成普通 `<a href>`；要接前端路由，用 `breadcrumbs` 插槽接管即可：

```vue
<FbkPageContainer :breadcrumbs="breadcrumbs">
  <template #breadcrumbs>
    <nav class="my-breadcrumbs">
      <RouterLink v-for="item in breadcrumbs" :key="item.text" :to="item.to">
        {{ item.text }}
      </RouterLink>
    </nav>
  </template>
</FbkPageContainer>
```

同理 `back` 可以是 `true`（抛 `back` 事件）或一个函数（调用方自己处理跳转）。

## 固定头部

```vue
<FbkPageContainer title="订单列表" fixed-header :max-width="1200">
  ...
</FbkPageContainer>
```

`fixedHeader` 用 `position: sticky`，不依赖滚动容器的高度计算，SSR 下也不会闪。

## 移动端

`extra` 插槽在窄屏下会换行显示在标题下方，走 CSS 容器查询而不是 JS 判断宽度。
内容区左右内边距由 `--fbk-spacing-*` 令牌控制。

## API

<ApiTable component="PageContainer" />

<ApiTable component="PageContainer" section="events" />

<ApiTable component="PageContainer" section="slots" />
