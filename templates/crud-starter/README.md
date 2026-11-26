# CRUD Starter

**复制 → 装 → 跑**，就有带分页的真实列表。三个页面都用 `@fbkworks/*` 组装，字段定义**只有一份**。

| 你会得到 | 用什么搭的 |
| --- | --- |
| 列表页（查询 + 表格 + 分页 + 排序） | `CrudPage` |
| 详情（整页 / 抽屉两种形态） | `DetailPage` / `DetailDrawer` |
| 新建 / 编辑弹窗（含必填校验、提交中禁用） | `FormModal` + `FormGenerator` |
| 一份字段定义派生三份视图 | `@fbkworks/schema` 的 `defineFields` + `toQueryFields/toColumns/toFormFields` |

**实测耗时**（本机 Windows、依赖已在本地 pnpm store、未走网络下载）：
复制目录 + `pnpm install` **10.0 s** → `pnpm dev` 起服务 **1.0 s** → 浏览器里出现 20 行带分页的列表 **3.0 s**，
合计 **14 秒**。冷装（要下载依赖）会多出下载时间，这是唯一不可控的一段。

---

## 三步

### 1. 装

```bash
# 在本仓库里：模板已经在 workspace 中，直接装一次
pnpm install

# 复制出去用：把这 6 个 workspace:* 换成已发布的版本号（^0.9.0 这一档），
# 否则 pnpm 无法解析 workspace 协议。仓库内复制（templates/<新名>）不需要改。
#   @fbkworks/{components,schema,data,adapter-core,adapter-element-plus,tokens}
```

### 2. 跑

```bash
pnpm -C templates/crud-starter dev     # http://localhost:5288
```

会看到：查询区（关键词 / 商品名 / 分类 / 状态）+ 表格（SKU / 商品名 / 分类 / 价格 / 库存 / 状态 / 上架时间 / 操作）
+ 分页（共 63 条）+ 「新建商品」弹窗 + 行内「详情」抽屉。
商品详情整页：`#/detail/3`。

### 3. 接自己的后端：只改 3 处

全部在 `src/product-api.ts`（列表 / 详情 / 保存），文件里用 `【替换点 n/3】` 标好了：

| # | 函数 | 现在（mock） | 换成 |
| --- | --- | --- | --- |
| 1 | `fetchProducts(query)` | 内存表筛选 + 切片 | `http.get('/api/products', { params, signal })`，用 `@fbkworks/data` 的 `createPageRequest` 映射成 `{ list, total }` |
| 2 | `fetchProduct(id)` | 内存里 `find` | `http.get(\`/api/products/\${id}\`)`；不存在就返回 `null`（页面自动渲染 404 态） |
| 3 | `saveProduct(values)` | 内存里 unshift / merge | `POST`（无 id）或 `PUT`（有 id） |

**不用改的**：`CrudPage` / `DetailPage` / `FormModal` 的用法、三个页面的 JSX、字段定义。
请求签名就是 `@fbkworks/data` 的 `PageQuery → Page`，库里认这一种，换后端不换写法。

---

## 为什么要用 `defineFields`

同一张业务表，以前要在 `QueryField` / `ProTableColumn` / `FormField` 三套类型里各写一遍。
写三遍的代价不是打字，是**漂移**：改了标签忘改列头、加了选项忘加查询下拉 ——
两处都合法、两处都编译通过、两处都不会红。

`src/product-fields.ts` 里只有一份 `productFields`，加上「这个字段出现在哪些视图」：

```ts
const productFields = defineFields([
  { name: 'remark', label: '备注', type: 'textarea', views: ['form'] },   // 只进表单
  { name: 'createdAt', label: '上架时间', type: 'date', views: ['column'] }, // 只进表格
  { name: 'status', label: '状态', type: 'select', options: PRODUCT_STATUS_OPTIONS,
    query:  { placeholder: '全部' },                    // → QueryField
    column: { valueType: 'enum', valueEnum: … },        // → ProTableColumn
    form:   { required: true } },                       // → FormField
])
```

加一个字段 = 加一行，三个视图一起变。删一个字段 = 删一行，不会留下「查询表单里还有它」的残骸。

**唯一的接缝**也写在这个文件里：schema 的键是三端中立的 `name / label`，
而表格契约要 `key / title / dataIndex`，所以 `toTableColumns()` 里做了 8 行通用映射 ——
写一次，不是每个字段再抄三个键。

---

## 文件

```
crud-starter/
├── index.html                  # vite 入口
├── vite.config.ts              # 独立配置：不 import 本仓库任何内部包，复制即用
├── package.json                # private: true（模板不是发布包）
├── src/
│   ├── main.ts                 # 样式接入顺序（令牌 → UI 库 → 适配器 → 组件库 → 应用）
│   ├── app.css                 # 应用自有样式
│   ├── App.vue                 # FbkProvider + 40 行 hash 路由
│   ├── product-fields.ts       # ★ 一份定义 → 查询 / 表格 / 表单三份视图
│   ├── product-api.ts          # ★ mock 后端；接真后端就改这里的 3 个函数
│   └── pages/
│       ├── ProductsPage.vue    # CrudPage + FormModal + DetailDrawer
│       └── ProductsDetailPage.vue  # DetailPage
└── tests/
    └── products.spec.ts        # 冒烟测试：三份视图 + 分页/筛选/排序/保存
```

---

## 测试与门禁

```bash
pnpm test                                  # 根 vitest 会跑到 templates/**/tests/**/*.spec.ts
pnpm -C templates/crud-starter build       # 模板自己的构建
pnpm check:template-smoke                  # 本仓库的模板门禁
```

模板**不另配 vitest**：它的用例跑在仓库根的同一个 runner 里（`vitest.config.ts` 的 include
含 `templates/**/tests/**/*.spec.ts`），所以 `pnpm test` / `pnpm verify` 一条命令就覆盖到它 ——
不需要「记得单独跑 `--config`」那种会烂掉的做法。

复制出去后 `tests/` 需要自己配一个 vitest（本仓库那份配置里的 `@fbkworks/*` alias 只在本仓库内有效）；
不想配就直接删掉它 —— 它不参与构建。
