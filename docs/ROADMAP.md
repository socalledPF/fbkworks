# ROADMAP

> 唯一标尺：**加速企业前端开发**。不追 1.0，不做商业化。
> 节奏按验收推进，不按日历 —— 每个 Horizon 结束都可用、可停。

## 现状基线（2026-11 核实）

| 维度 | 现状 |
| --- | --- |
| 包 | 12 个：8 个固定组 `0.9.0`；`data 0.6.0`；`tokens/shared/resolver 0.3.0` |
| 待发布 changeset | 0 |
| 仓库内 TODO/FIXME | 0 —— 债不写成标记，写成**可执行的检查** |
| 能力矩阵 | 已诚实：虚拟滚动 / 展开行 / 树形 / 固定表头 三端全 ❌ |
| 门禁 | `pnpm verify` 23 步，与 `ci.yml` 一一对应 |
| 已知硬债 | a11y 181 处 serious+critical / 38 页（仅棘轮）；三端语义差异 4 处；`dataZoom` 页面级崩溃成因未查明 |
| 三个 app | `docs`（文档站）、`playground`（16 条 demo / 6 组）、`admin`（狗粮后台 demo，private 未发布） |

**结论：功能数量已不是瓶颈。** 真正拖慢企业前端的是「接一次要多久」「同一件事写几遍」「写错了多久能发现」。

---

## 四条判据

路线是否有效只看这四条，其它都是手段。

1. **新业务页从 0 到有数据的时间** —— 目标 ≤ 30 分钟（现在要读文档 + 抄 demo + 自己拼）。
2. **同一实体的字段定义写几份** —— 现在是**三套类型**（`FormField` / `QueryField` / `ProTableColumn`），同一张表写三遍。目标：1 份。
3. **「静默无效」缺陷复发数** —— 一次评审里删掉过 12 个「声明了但从不读取」的字段。目标：新字段必须有 dev 期校验兜底。
4. **业务侧因三端差异写的条件分支** —— 目标：库内消化，业务侧零分支。

---

## H1 · 接入加速（最高优先级）

### 1.1 字段元数据单一来源（最大加速点）

新建 `packages/schema`：一份定义，三种视图。

```ts
const orderFields = defineFields([
  { name: 'status', label: '状态', type: 'select', options: ORDER_STATUS,
    query:  { placeholder: '全部' },         // → QueryField
    column: { width: 120, sortable: true },  // → ProTableColumn
    form:   { required: true },              // → FormField
  },
])

toQueryFields(orderFields)   // 导出成 QueryForm 的 fields
toColumns(orderFields)       // 导出成 ProTable 的 columns
toFormFields(orderFields)    // 导出成 FormGenerator 的 schema.fields
```

改动面：
- 新包 `packages/schema/src/index.ts`：`defineFields` + 三个派生器，纯函数、零依赖、无 vue；
- 三个组件的 `types.ts` **只加注释**推荐派生器（现类型不动 —— 不破版）；
- `apps/admin` 的 Orders 页改成同一份定义，作为**可跑的范例**；
- `apps/docs/components/schema.md`：三份手写 vs 一份派生的对照。

### 1.2 `templates/crud-starter`

`apps/admin` 是 demo（private、README 自称 demo），不对外。另起模板目录：
- 列表页 + 详情页 + 表单弹窗，用 `CrudPage` / `DetailPage` / `FormModal` 三件套 + mock 数据；
- **自带能被 `pnpm test` 跑到的冒烟测试**（admin 的用例只能靠 `--config` 单独跑，等于会烂掉）；
- README 写明「替换 3 处文件即可接自己的后端」+ 一句实测耗时。

### 1.3 开发期 prop 校验

`adapter-core` 加 `devWarnUnknownProps()`，**仅 `import.meta.env.DEV` 生效**：
- 组件 `setup` 里比对契约字段，未实现字段显式 `warnOnce('该字段当前无效')`；
- 统一走 `warnOnce` 而不是 `console.error`（后者会被 console 门禁抓）。

这类缺陷最贵：传了不生效时，用户只会怀疑自己。

### 1.4 文档 5 分钟接入路径

`apps/docs/guide/quickstart.md` 重写为三步：装包 → 挂 `FbkProvider` → 抄模板里一个页面。
现在文档从架构图开始，对新人不友好。

---

## H2 · 组合复用

- **2.1 三种页面骨架**：`useCrudPage` / `useDetailPage` / `useFormPage`，把已修过的坑（`immediate`、`hasMore`、`close` 只发一次、`pendingValues` 清理）固化成默认行为；
- **2.2 mock 与真实同构**：`@fbkworks/data/mock` 的 `createMockTable()`，支持过滤/排序/分页，与真实接口同一套 `PageQuery / PageResult`；
- **2.3 权限与异常页**：admin 里手写的 `ExceptionPage` 提取为组件 + `usePermission`。

---

## H3 · 质量与稳定（不设日期，随 H1/H2 顺带做）

- **3.1 a11y 还债**：181 处按组件族分批，每批附基线下降数，独立可验收；
- **3.2 三端语义收敛**：剩余差异做成单张表 + 门禁比对，禁止新增差异；
- **3.3 契约冻结准备**：`ADAPTER_API_VERSION` 的升版规则写进 `AGENTS.md`。

---

## 非目标（明确不做）

- **不追 1.0**：`0.x` 继续允许破版，但必须带 changeset + 迁移说明；
- **不做商业化**：不建付费层、不做多租户授权；
- **不新增组件族**：H1/H2 只做「把已有的组装起来」，除非真实业务页需要；
- **不做 i18n / SSR / 微前端**：三个 app 都是内部中后台，要出海或做门户时再立专项；
- **不给 a11y 定日期**：只保证「不再新增」。

---

## 新增门禁（每道都必须能证伪）

| 门禁 | 检查什么 | 证伪方式 |
| --- | --- | --- |
| `check:schema-parity` | 模板与 admin 里若手写两份同名字段定义 → 红 | 故意在模板里重写一遍字段 |
| `check:dev-warn` | 每个公开 prop 要么被读取、要么有 `warnOnce` 说明「当前无效」 | 给某组件加一个不读取的 prop |
| `check:template-smoke` | `templates/*` 必须能 `pnpm build` 通过 | 删掉模板的一个依赖 |

---

## 假设与可推翻点

| 假设 | 若被推翻怎么办 |
| --- | --- |
| 字段三写一遍是真实痛点 | 先做 1.1 的一周验证：拿 admin 的 Orders 页试改；没省下时间就砍掉这一项 |
| 企业前端主要是「列表 + 表单 + 详情」 | 若实际上大量是大屏/看板，H2 改成图表侧优先 |
| `templates/` 比改 admin 更值得 | 若 admin 本身要对外，直接把它升级为模板（需给它接测试入口） |
| 三端差异应由库内消化 | 若是 UI 库本身的产品边界（如 vant 的 `filterable` 必须自绘），改为「按能力位显式降级 + 文档表格」 |

---

## 第一批任务（三个 PR 级，互不依赖可并行）

| # | 内容 | 验收 |
| --- | --- | --- |
| PR-A | `packages/schema` 骨架 + `defineFields` + 三个派生器 + 单测（不含 admin 改造） | 单测覆盖「一份定义派生三份视图」与字段缺省值 |
| PR-B | `templates/crud-starter` + 冒烟测试 + `check:template-smoke` 门禁（含证伪输入） | 模板可独立 `pnpm dev` 跑起来 |
| PR-C | `devWarnUnknownProps` + `check:dev-warn` 门禁 + 给已删字段补警告文案 | 传 `hideInCard` 得到可执行提示（指向 `mobile.hidden`） |

每个 PR 必须过 `pnpm verify`，并附**能被证伪**的证据（见 `AGENTS.md` 第二节）。