# @fbkworks/tokens

FBK 业务组件库的设计令牌层。只描述语义，不绑定任何 UI 库，产出 `--fbk-*` CSS 变量。

```bash
pnpm add @fbkworks/tokens
```

## 使用

```ts
import '@fbkworks/tokens/css'      // 亮色令牌
import '@fbkworks/tokens/dark.css' // 暗色覆盖（html[data-fbk-theme='dark']）
```

```ts
import { defaultTokens, toCssVars, darkColorOverrides } from '@fbkworks/tokens'

document.documentElement.style.cssText += toCssVars(defaultTokens)
```

适配器负责把令牌映射成 `--el-*` / `--van-*` / naive-ui 的 provider 配置。
业务组件只读 `--fbk-*`，因此换 UI 库时业务样式不需要改。

## 令牌分组

`color` / `spacing` / `radius` / `shadow` / `fontSize` / `fontFamily` / `lineHeight` / `zIndex` / `transition`。

## License

MIT
