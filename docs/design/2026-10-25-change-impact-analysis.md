# 设计稿：变更影响分析（P3-1）

> 企业级前端架构计划的 P3-1。团队超过 5 人时价值显著。

## 一、问题

改了 `ProTable`，怎么知道哪些地方会受影响？

现状是**靠人记**：

- 改 `use-table-request.ts` → 谁会坏？
- 改了 `@fbkworks/data` 的 `Page` 类型 → 哪些页面要跟着改？
- 删了一个导出 → 有没有人在用？

CI 只能告诉你「构建通过」，构建通过**不等于**功能没坏。

## 二、目标与非目标

### 目标

1. 给一个变更文件列表，输出**受影响的文件 / 包 / 应用**
2. 在 PR 里自动贴出影响范围（不阻断合并）
3. 支持两种输入：`git diff` 自动取，或手动指定

### 非目标

| 不做 | 理由 |
|---|---|
| 阻断 CI | 影响范围大不等于有问题，判断权在人 |
| 语义级影响分析 | 需要 AST 类型流分析，成本远超收益 |
| 跨仓库分析 | 单仓场景够用 |
| 运行时影响 | 那是 e2e 的事 |

## 三、数据源

`dependency-cruiser` 已经算出了完整依赖图（255 个模块），
配置里已有 `--output-type json`：

```bash
depcruise packages apps --config dependency-cruiser.config.mjs --output-type json
```

每个模块有 `source` / `dependencies` / `dependents`。
**但 `dependents` 只有直接依赖**，传递闭包要自己算。

## 四、算法

### 4.1 反向传递闭包

```
输入：变更文件集 C
构建反向邻接表：file → 直接依赖它的文件
BFS：
  queue = C
  while queue:
    x = queue.pop()
    for y in reverseAdj[x]:
      if y not visited:
        visited.add(y); queue.push(y)
输出：visited（直接影响 + 间接影响）
```

复杂度 O(V+E)，255 个模块瞬间完成。

### 4.2 需要处理的边界

| 情况 | 处理 |
|---|---|
| 变更文件不在图里（新增文件） | 按文件名匹配「谁可能 import 它」——用目录前缀推断 |
| 变更的是 `package.json` | 整个包及其反向依赖都算受影响 |
| 变更的是 `style.css` | 只沿 `@import` 链传播，不沿 JS import |
| 循环依赖 | BFS 的 visited 天然避免死循环 |
| 变更的是配置文件 | 全量受影响（提示「配置变更，建议全测」） |

### 4.3 输出分级

按距离给出影响等级，便于判断要测多少：

| 距离 | 等级 | 含义 |
|---|---|---|
| 0 | `changed` | 改动本身 |
| 1 | `direct` | 直接依赖，大概率要改 |
| 2-3 | `indirect` | 间接依赖，可能要验证 |
| >3 | `transitive` | 深层影响，通常只需冒烟 |

## 五、输出格式

### 5.1 终端（本地用）

```
变更影响分析
─────────────
改动 2 个文件：
  packages/components/src/pro-table/use-table-request.ts
  packages/data/src/types.ts

直接影响（1）：
  packages/components/src/pro-table/ProTable.vue

间接影响（12）：
  packages/components/src/crud-page/CrudPage.vue
  ...

受影响的应用（2）：
  apps/admin  (3 个页面)
  apps/playground (1 个 demo)

建议验证：
  pnpm --filter @fbkworks/components test
  python scripts/visual/verify-admin.py
```

### 5.2 Markdown（CI 用）

生成一段可贴到 PR 评论的 Markdown，含折叠的完整清单。

## 六、实现

```
scripts/
  check-impact.mjs        命令行入口
  lib/
    build-graph.mjs       调 depcruise 拿图 + 建反向邻接表
    analyze.mjs           反向传递闭包 + 分级
    report.mjs            终端 / Markdown 两种输出
```

**为什么分开**：`analyze` 是纯函数（输入图 + 变更集，输出影响集），
可以单元测试；`build-graph` 依赖外部命令，测试时 mock。

### 6.1 命令行

```bash
# 自动从 git diff 取（默认对比 HEAD~1）
node scripts/check-impact.mjs

# 指定 base 分支
node scripts/check-impact.mjs --base origin/main

# 手动指定文件
node scripts/check-impact.mjs --files packages/components/src/pro-table/ProTable.vue

# 输出 Markdown（CI 贴评论用）
node scripts/check-impact.mjs --format markdown

# 输出 JSON（给其他工具消费）
node scripts/check-impact.mjs --format json
```

### 6.2 退出码约定

**永远返回 0**（除非脚本自身出错）。

理由：影响范围大不等于有问题。如果影响大就阻断，团队会开始
「为了过 CI 而拆小 PR」，反而让变更更难审查。

## 七、门禁接入

| 位置 | 动作 |
|---|---|
| `pnpm check:impact` | 新增，**不进 verify**（它需要 git 历史，CI 里单独跑） |
| `.github/workflows/ci.yml` | PR 上跑一次，把 Markdown 贴到 PR 评论 |

**为什么不进 verify**：verify 是「代码正确性」门禁，应该幂等；
变更影响依赖 git 状态，同一份代码在不同 PR 里结果不同。

## 八、验收

| 项 | 标准 |
|---|---|
| 算法 | 单测覆盖：直接/间接/循环/新增文件/配置变更 |
| 真实图 | 拿当前仓库跑一遍，结果与人工判断一致 |
| 性能 | 255 模块下 < 2 秒 |
| 输出 | 终端 / Markdown / JSON 三种格式 |
| 退出码 | 永远 0（脚本自身错误除外） |
| 隔离 | 不对现有 verify 产生任何影响 |

## 九、不做的事

| 不做 | 理由 |
|---|---|
| AST 级语义分析 | 判断「改了函数签名，调用方是否传对参数」需要完整类型检查，`tsc` 已经在做 |
| 可视化依赖图 | 已有 `architecture-diagrams.md`，图上加变更高亮收益低 |
| 自动跑受影响的测试 | 看起来诱人，但 Vitest 的全量测试只要几秒，选择性执行反而更慢 |
