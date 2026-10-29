# @fbkworks/resolver

`@fbkworks/components` 的 unplugin-vue-components 解析器。

```bash
pnpm add -D unplugin-vue-components @fbkworks/resolver
```

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { FbkResolver } from '@fbkworks/resolver'

export default defineConfig({
  plugins: [Components({ resolvers: [FbkResolver()] })],
})
```

之后可以直接写 `<FbkProTable />`，组件与对应样式自动引入。

::: warning 它不解决适配器注入
resolver 只决定"组件和样式从哪来"。仍然需要在入口执行
`app.use(createBusinessKit({ adapter }))`，否则 `useAdapter()` 会抛错。
:::

## License

MIT
