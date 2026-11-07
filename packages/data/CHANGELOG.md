# @fbkworks/data

## 0.3.0

### Minor Changes

- 78877e5: 首次公开发布：版本号与 UI 栈对齐到 0.3.0

  这四个包本次没有代码变更。写这条 changeset 的唯一目的是让**第一次**发布时
  所有包同号，避免「kit 说是 0.3.0，tokens 却是 0.2.0」这种首发噪音。

  **这是一次性的，不是常设耦合。** 从 0.4.0 起它们各自独立演进：

  - 补丁级修复只发受影响的包（`workspace:^` 的 `^0.3.0` 范围不会因此失效）
  - 破坏性变更仍会牵动下游，由 changesets 的 `updateInternalDependencies: "patch"`
    自动把下游的 patch 版本带起来

  见 `.changeset/config.json` 的 `fixed` 组：现在只剩 8 个 UI 栈包锁步
  （adapter-core / chart-core / 三个适配器 / components / dashboard / screen）。
  tokens、shared、data、resolver 已不在其中。

### Patch Changes

- Updated dependencies [78877e5]
  - @fbkworks/shared@0.3.0

## 0.2.0

### Minor Changes

- c802946: feat(data): 新增契约层 `@fbkworks/data`，分页契约收敛为单一定义处

  ### 新增

  `createPageRequest` 把任意形状的后端响应映射成 `Page<T>`，业务方只写
  「字段在哪」。支持点号路径（含数组下标）、业务码判定、行映射、
  数据级权限声明、错误上报钩子。

  ### 行为变化

  - **`@fbkworks/components` 的分页契约改为 `@fbkworks/data` 的别名**：
    `TableRequestParams` = `PageQuery`、`TableResponse` = 放宽 total 的 `Page`、
    `TableRequest` 结构不变。现有调用零改动，但类型定义的来源变了。
  - 之前的「两处同形接口 + 注释声称兼容」改为编译期断言
    （`packages/components/tests/contract-compat.spec.ts`）。任何人改动
    `@fbkworks/data` 的分页契约，components 侧会立刻编译失败。
  - `createPageRequest` 新增 `onError` / `feature` 配置，用于错误上报。
    `AbortError` 不上报（取消不是错误）。

- 3ea4bcf: feat(data): 新增 `defineBackend`，后端惯例只写一次

  ### 问题

  一个项目通常只有 1-2 种响应形状，但 `createPageRequest` 要求每个
  列表接口重复描述 `rows` / `total` / `isSuccess` / `errorMessage`。
  12 个接口 × 6 行 = 72 行，其中 60 行是纯重复。

  ### 解法

  ```ts
  // src/api/backend.ts —— 全项目唯一一处
  export const api = defineBackend({
    request: (url, params, signal) => http.get(url, { params, signal }).then((r) => r.data),
    rows: 'content',
    total: 'totalElements',
    isSuccess: (res) => res.code === 200,
    errorMessage: (res) => res.msg,
    mapParams: ({ page, pageSize, params }) => ({ pageNum: page, pageSize, ...params }),
  })

  // src/api/order.ts —— 每个接口只剩自己的信息
  export const fetchOrders = api.page('/api/order/list', { feature: 'order.list' })
  ```

  ### 两种形态

  - **A** 传路径：`api.page('/api/orders')`，用后端惯例的 `request`
  - **B** 传 fetcher：`api.page(({ page, signal }) => http.get(...))`，逃生口

  B 形态只接管「怎么发请求」，解析仍用后端配置。

  ### 兼容

  `createPageRequest` 完全不变，`defineBackend` 是叠加的层。
  内部也复用它 —— 错误上报、路径解析、AbortError 不吞等行为自动继承，
  不存在两套实现漂移。

### Patch Changes

- 7f1024d: fix(data): `total` 为 null / 空字符串时抛错，不再静默当成 0

  ### 行为变化（需要关注）

  `Number(null) === 0`、`Number('') === 0` —— 之前 `extractTotal` 会把
  `total: null` 静默转成 0。

  后果：后端返回 `total: null`（「暂无数据」或字段未初始化时很常见）时，
  分页器显示「共 0 条」，而实际可能有数据。用户看到的是错误信息，
  且没有任何报错，排查成本很高。

  现在抛 `FbkDataError`，消息里解释原因并给出替代方案
  （`total: (raw) => rows.length` 或直接不传 `total`）。

  ### 如果确实可能没有 total

  ```ts
  // 方案一：用列表长度兜底
  createPageRequest({ fetch, rows: 'rows', total: (raw) => raw.rows.length })

  // 方案二：不传 total（默认用 rows.length）
  createPageRequest({ fetch, rows: 'rows' })
  ```

- Updated dependencies [1a36dc8]
  - @fbkworks/shared@0.2.0
